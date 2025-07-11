import { loadConfig, saveConfig } from '../config/index.js';
import { compressWithRetry, canCompress } from '../compression/index.js';
import { validateFileForProcessing, createBackupDirectory, backupFile, formatBytes, scanForImages } from '../utils/fileOps.js';
import { handleCompressionError, handleFileSystemError, handleConfigError, formatErrorMessage } from '../utils/errorHandler.js';
import path from 'path';
import fs from 'fs-extra';
import tinify from 'tinify';
import cliProgress from 'cli-progress';

async function compressDirCommand(dirPath, apiKeyName, options = {}) {
  const resolvedDirPath = path.resolve(dirPath);
  
  try {
    // Validate directory exists
    if (!fs.existsSync(resolvedDirPath)) {
      throw new Error(`Directory not found: ${resolvedDirPath}`);
    }
    
    if (!fs.statSync(resolvedDirPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedDirPath}`);
    }
    
    // Load configuration
    const config = await loadConfig();
    
    // Validate API key
    const apiKey = config.apiKeys.find(key => key.name === apiKeyName);
    if (!apiKey) {
      const availableKeys = config.apiKeys.map(k => k.name).join(', ');
      throw new Error(`API key '${apiKeyName}' not found. Available keys: ${availableKeys}`);
    }
    
    // Scan for images
    console.log(`Scanning directory: ${dirPath}`);
    const imageFiles = scanForImages(resolvedDirPath, options.recursive);
    
    if (imageFiles.length === 0) {
      console.log('No supported image files found in directory');
      return;
    }
    
    console.log(`Found ${imageFiles.length} supported image files`);
    
    // Calculate total size
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    console.log(`Total size: ${formatBytes(totalSize)}`);
    
    // Check API key capacity
    const availableCompressions = 500 - apiKey.compressions_used;
    console.log(`\nChecking API key '${apiKeyName}'...`);
    console.log(`✓ ${availableCompressions} compressions available`);
    
    if (availableCompressions < imageFiles.length) {
      console.log(`⚠️  Warning: Only ${availableCompressions} compressions available, but ${imageFiles.length} files found`);
      console.log(`   Only the first ${availableCompressions} files will be processed`);
    }
    
    // Validate files
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of imageFiles) {
      const errors = validateFileForProcessing(file.path);
      if (errors.length === 0) {
        validFiles.push(file);
      } else {
        invalidFiles.push({ file: file.path, errors });
      }
    }
    
    if (invalidFiles.length > 0) {
      console.log(`\n⚠️  ${invalidFiles.length} files failed validation:`);
      invalidFiles.forEach(({ file, errors }) => {
        console.log(`   ${path.basename(file)}: ${errors.join(', ')}`);
      });
    }
    
    if (validFiles.length === 0) {
      console.log('No valid files to process');
      return;
    }
    
    // Create backup directory
    const backupDir = path.join(resolvedDirPath, 'original');
    console.log(`\nCreating backup directory: ${backupDir}`);
    fs.ensureDirSync(backupDir);
    
    // Backup files
    console.log('Backing up original files...');
    const backupResults = await backupFiles(validFiles, backupDir);
    
    console.log(`✓ Backup completed: ${backupResults.created} new, ${backupResults.skipped} skipped, ${backupResults.versioned} versioned`);
    
    if (backupResults.errors.length > 0) {
      console.log(`   ${backupResults.errors.length} backup errors occurred`);
      backupResults.errors.forEach(error => {
        console.log(`   ${path.basename(error.file)}: ${error.error}`);
      });
    }
    
    // Process files with progress bar
    const filesToProcess = validFiles.slice(0, availableCompressions);
    const compressionResults = await processFilesWithProgress(filesToProcess, apiKey, options);
    
    // Update API key usage
    apiKey.compressions_used = compressionResults.finalCompressionCount;
    await saveConfig(config);
    
    // Display results
    displayCompressionReport(compressionResults, apiKeyName);
    
    return compressionResults;
    
  } catch (err) {
    let errorInfo;
    
    if (err instanceof tinify.AccountError || err instanceof tinify.ClientError || 
        err instanceof tinify.ServerError || err instanceof tinify.ConnectionError) {
      errorInfo = handleCompressionError(err, apiKeyName, resolvedDirPath);
    } else if (err.code && (err.code.startsWith('E'))) {
      errorInfo = handleFileSystemError(err, resolvedDirPath);
    } else if (err.message.includes('Configuration file not found')) {
      errorInfo = handleConfigError(err);
    } else if (err.message.includes('API key') && err.message.includes('not found') && err.message.includes('Available keys:')) {
      // Handle API key not found error specifically
      errorInfo = {
        type: 'API_KEY_NOT_FOUND',
        message: err.message,
        suggestion: `Check available API keys with 'tinypng-compress --check' or add a new key with 'tinypng-compress --new-key'`
      };
    } else if (err.message.includes('config') || err.message.includes('validation')) {
      errorInfo = handleConfigError(err);
    } else {
      errorInfo = {
        type: 'UNKNOWN_ERROR',
        message: err.message,
        suggestion: 'If this issue persists, please check the documentation or file an issue.'
      };
    }
    
    throw new Error(formatErrorMessage(errorInfo));
  }
}

async function backupFiles(files, backupDirectory) {
  const results = {
    created: 0,
    skipped: 0,
    versioned: 0,
    errors: []
  };
  
  for (const file of files) {
    try {
      const result = await backupFile(file.path, backupDirectory);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.versioned) {
        results.versioned++;
      } else {
        results.created++;
      }
      
    } catch (err) {
      results.errors.push({
        file: file.path,
        error: err.message
      });
    }
  }
  
  return results;
}

async function processFilesWithProgress(files, apiKey, options = {}) {
  const results = {
    successful: [],
    failed: [],
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    totalSavings: 0,
    processingTime: 0,
    finalCompressionCount: apiKey.compressions_used
  };
  
  const startTime = Date.now();
  
  // Create progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Compressing |{bar}| {percentage}% | {value}/{total} | {current} | Saved: {savings}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);
  
  progressBar.start(files.length, 0, {
    current: 'Starting...',
    savings: '0 B'
  });
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // Check if we still have compressions available
      if (results.finalCompressionCount >= 500) {
        const remaining = files.slice(i);
        results.failed.push(...remaining.map(f => ({
          file: f.path,
          error: 'API key reached monthly limit',
          reason: 'limit_reached'
        })));
        break;
      }
      
      // Update progress with current file
      progressBar.update(i, {
        current: path.basename(file.path),
        savings: formatBytes(results.totalSavings)
      });
      
      // Compress file
      const compressionOptions = {
        preserveMetadata: options.preserveMetadata,
        convert: options.convert
      };
      
      const result = await compressWithRetry(file.path, apiKey, compressionOptions);
      
      results.successful.push({
        file: file.path,
        outputPath: result.outputPath,
        ...result
      });
      
      results.totalOriginalSize += result.originalSize;
      results.totalCompressedSize += result.compressedSize;
      results.totalSavings += result.savings;
      results.finalCompressionCount = result.compressionCount;
      
      // Update progress with results
      const fileName = path.basename(file.path);
      const outputFileName = path.basename(result.outputPath || file.path);
      const displayName = result.outputPath && result.outputPath !== file.path ? 
        `${fileName} → ${outputFileName}` : fileName;
      
      progressBar.update(i + 1, {
        current: `✓ ${displayName}`,
        savings: formatBytes(results.totalSavings)
      });
      
      // Add small delay to respect rate limits
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (err) {
      results.failed.push({
        file: file.path,
        error: err.message,
        reason: err.name || 'unknown'
      });
      
      progressBar.update(i + 1, {
        current: `❌ ${path.basename(file.path)}`,
        savings: formatBytes(results.totalSavings)
      });
    }
  }
  
  progressBar.stop();
  results.processingTime = Date.now() - startTime;
  
  return results;
}

function displayCompressionReport(results, apiKeyName) {
  const stats = calculateCompressionStats(results);
  
  console.log('\n📊 Compression Report');
  console.log('='.repeat(50));
  
  // Summary
  console.log(`\n📁 Files Processed:`);
  console.log(`   Total: ${stats.totalFiles}`);
  console.log(`   Successful: ${stats.successfulFiles} (${stats.successRate.toFixed(1)}%)`);
  console.log(`   Failed: ${stats.failedFiles}`);
  
  if (stats.successfulFiles > 0) {
    // Size statistics
    console.log(`\n💾 Size Statistics:`);
    console.log(`   Original: ${formatBytes(stats.totalOriginalSize)}`);
    console.log(`   Compressed: ${formatBytes(stats.totalCompressedSize)}`);
    if (stats.totalSavings >= 0) {
      console.log(`   Saved: ${formatBytes(stats.totalSavings)} (${stats.averageCompressionRatio.toFixed(1)}%)`);
    } else {
      console.log(`   Increased: ${formatBytes(Math.abs(stats.totalSavings))} (${Math.abs(stats.averageCompressionRatio).toFixed(1)}% larger)`);
    }
    
    // Performance
    console.log(`\n⚡ Performance:`);
    console.log(`   Processing Time: ${(stats.processingTime / 1000).toFixed(1)}s`);
    console.log(`   Throughput: ${stats.throughput.toFixed(1)} files/second`);
    
    // By file type
    if (Object.keys(stats.byFileType).length > 0) {
      console.log(`\n📋 By File Type:`);
      
      for (const [ext, typeStats] of Object.entries(stats.byFileType)) {
        const typeRatio = (typeStats.savings / typeStats.originalSize) * 100;
        if (typeRatio >= 0) {
          console.log(`   ${ext.toUpperCase()}: ${typeStats.count} files, ${formatBytes(typeStats.savings)} saved (${typeRatio.toFixed(1)}%)`);
        } else {
          console.log(`   ${ext.toUpperCase()}: ${typeStats.count} files, ${formatBytes(Math.abs(typeStats.savings))} larger (${Math.abs(typeRatio).toFixed(1)}% increase)`);
        }
      }
    }
  }
  
  // API usage
  const remaining = 500 - results.finalCompressionCount;
  console.log(`\n🔑 API Key Usage:`);
  console.log(`   ${apiKeyName}: ${results.finalCompressionCount}/500 compressions used (${remaining} remaining)`);
  
  // Converted files
  const convertedFiles = results.successful.filter(r => r.outputPath && r.outputPath !== r.file);
  if (convertedFiles.length > 0) {
    console.log(`\n🔄 Converted Files:`);
    convertedFiles.forEach(result => {
      const originalName = path.basename(result.file);
      const convertedName = path.basename(result.outputPath);
      console.log(`   ${originalName} → ${convertedName}`);
    });
  }
  
  // Failed files
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed Files:`);
    results.failed.forEach(failure => {
      console.log(`   ${path.basename(failure.file)}: ${failure.error}`);
    });
  }
}

function calculateCompressionStats(results) {
  const stats = {
    totalFiles: results.successful.length + results.failed.length,
    successfulFiles: results.successful.length,
    failedFiles: results.failed.length,
    successRate: 0,
    totalOriginalSize: results.totalOriginalSize,
    totalCompressedSize: results.totalCompressedSize,
    totalSavings: results.totalSavings,
    averageCompressionRatio: 0,
    processingTime: results.processingTime,
    throughput: 0,
    byFileType: {}
  };
  
  if (stats.totalFiles > 0) {
    stats.successRate = (stats.successfulFiles / stats.totalFiles) * 100;
  }
  
  if (stats.totalOriginalSize > 0) {
    stats.averageCompressionRatio = (stats.totalSavings / stats.totalOriginalSize) * 100;
  }
  
  if (results.processingTime > 0) {
    stats.throughput = (stats.successfulFiles / results.processingTime) * 1000;
  }
  
  // Group by file type (using output file extension for converted files)
  for (const result of results.successful) {
    const ext = path.extname(result.outputPath || result.file).toLowerCase();
    
    if (!stats.byFileType[ext]) {
      stats.byFileType[ext] = {
        count: 0,
        originalSize: 0,
        compressedSize: 0,
        savings: 0
      };
    }
    
    stats.byFileType[ext].count++;
    stats.byFileType[ext].originalSize += result.originalSize;
    stats.byFileType[ext].compressedSize += result.compressedSize;
    stats.byFileType[ext].savings += result.savings;
  }
  
  return stats;
}

export default compressDirCommand;