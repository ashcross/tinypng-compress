# File Operations Specification

## Directory Scanning

### Image File Discovery
```javascript
import path from 'path';
import fs from 'fs-extra';

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];

function scanForImages(directory, recursive = false) {
  const imageFiles = [];
  
  function scanDirectory(dir, basePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        scanDirectory(fullPath, relativePath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          imageFiles.push({
            path: fullPath,
            relativePath: relativePath,
            name: entry.name,
            size: fs.statSync(fullPath).size
          });
        }
      }
    }
  }
  
  try {
    scanDirectory(directory);
    return imageFiles.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    throw new Error(`Failed to scan directory ${directory}: ${err.message}`);
  }
}
```

### File Size Estimation
```javascript
function calculateBatchSize(files) {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const averageSize = totalSize / files.length;
  
  // Estimate compressed size (typically 20-40% reduction)
  const estimatedCompressedSize = totalSize * 0.75;
  
  return {
    totalFiles: files.length,
    totalSize: totalSize,
    averageSize: averageSize,
    estimatedCompressedSize: estimatedCompressedSize,
    estimatedSavings: totalSize - estimatedCompressedSize
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

## Backup System

### Backup Directory Creation
```javascript
function createBackupDirectory(baseDirectory) {
  const backupPath = path.join(baseDirectory, 'original');
  
  try {
    // Create backup directory if it doesn't exist
    fs.ensureDirSync(backupPath);
    
    // Check if backup directory already has files
    const existingFiles = fs.readdirSync(backupPath);
    if (existingFiles.length > 0) {
      console.warn(`⚠️  Backup directory already contains ${existingFiles.length} files`);
      console.warn(`   Existing backups will be preserved`);
    }
    
    return backupPath;
    
  } catch (err) {
    throw new Error(`Failed to create backup directory: ${err.message}`);
  }
}
```

### File Backup Operations
```javascript
async function backupFile(filePath, backupDirectory) {
  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDirectory, fileName);
  
  // Check if backup already exists
  if (fs.existsSync(backupPath)) {
    const originalStat = fs.statSync(filePath);
    const backupStat = fs.statSync(backupPath);
    
    // Skip if identical (same size and modification time)
    if (originalStat.size === backupStat.size && 
        originalStat.mtime.getTime() === backupStat.mtime.getTime()) {
      return { skipped: true, path: backupPath };
    }
    
    // Create versioned backup if different
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const versionedName = `${base}_${timestamp}${ext}`;
    const versionedPath = path.join(backupDirectory, versionedName);
    
    await fs.copy(filePath, versionedPath, { preserveTimestamps: true });
    return { created: true, path: versionedPath, versioned: true };
  }
  
  // Create new backup
  await fs.copy(filePath, backupPath, { preserveTimestamps: true });
  return { created: true, path: backupPath };
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
```

## File Processing Pipeline

### Single File Compression
```javascript
import tinify from 'tinify';

async function compressFile(inputPath, apiKey, options = {}) {
  tinify.key = apiKey.key;
  
  const startTime = Date.now();
  const originalSize = fs.statSync(inputPath).size;
  
  try {
    // Create source from file
    const source = tinify.fromFile(inputPath);
    
    // Apply transformations if specified
    let processedSource = source;
    
    if (options.resize) {
      processedSource = source.resize(options.resize);
    }
    
    if (options.convert) {
      const convertOptions = { type: options.convert };
      if (options.background) {
        convertOptions.transform = { background: options.background };
      }
      processedSource = source.convert(convertOptions);
    }
    
    if (options.preserveMetadata) {
      processedSource = processedSource.preserve("copyright", "creation", "location");
    }
    
    // Compress to temporary file first
    const tempPath = inputPath + '.tmp';
    await processedSource.toFile(tempPath);
    
    // Get compressed size
    const compressedSize = fs.statSync(tempPath).size;
    
    // Atomic replace original file
    await fs.move(tempPath, inputPath);
    
    const processingTime = Date.now() - startTime;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    
    return {
      success: true,
      originalSize,
      compressedSize,
      savings: originalSize - compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      processingTime,
      compressionCount: tinify.compressionCount
    };
    
  } catch (err) {
    // Clean up temp file if it exists
    const tempPath = inputPath + '.tmp';
    if (fs.existsSync(tempPath)) {
      await fs.unlink(tempPath);
    }
    throw err;
  }
}
```

### Batch Processing with Progress
```javascript
async function processBatch(files, apiKey, options = {}) {
  const results = {
    successful: [],
    failed: [],
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    totalSavings: 0,
    processingTime: 0
  };
  
  const startTime = Date.now();
  let currentUsage = apiKey.compressions_used;
  
  // Create progress bar
  const progressBar = createProgressBar(files.length);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      // Check if we still have compressions available
      if (currentUsage >= 500) {
        const remaining = files.slice(i);
        results.failed.push(...remaining.map(f => ({
          file: f.path,
          error: 'API key reached monthly limit',
          reason: 'limit_reached'
        })));
        break;
      }
      
      // Compress file
      const result = await compressFile(file.path, apiKey, options);
      
      results.successful.push({
        file: file.path,
        ...result
      });
      
      results.totalOriginalSize += result.originalSize;
      results.totalCompressedSize += result.compressedSize;
      results.totalSavings += result.savings;
      
      currentUsage = result.compressionCount;
      
      // Update progress
      progressBar.update(i + 1, {
        current: path.basename(file.path),
        savings: formatBytes(results.totalSavings)
      });
      
      // Add delay to respect rate limits
      if (options.requestDelay && i < files.length - 1) {
        await delay(options.requestDelay);
      }
      
    } catch (err) {
      results.failed.push({
        file: file.path,
        error: err.message,
        reason: err.name || 'unknown'
      });
      
      progressBar.update(i + 1, {
        current: `❌ ${path.basename(file.path)}`
      });
    }
  }
  
  progressBar.stop();
  results.processingTime = Date.now() - startTime;
  
  return results;
}

function createProgressBar(total) {
  import cliProgress from 'cli-progress';
  
  return new cliProgress.SingleBar({
    format: 'Compressing |{bar}| {percentage}% | {value}/{total} | {current} | Saved: {savings}',
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);
}
```

## File Safety and Validation

### Pre-processing Validation
```javascript
function validateFileForProcessing(filePath) {
  const errors = [];
  
  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`);
    return errors;
  }
  
  const stats = fs.statSync(filePath);
  
  // Check if it's a file (not directory)
  if (!stats.isFile()) {
    errors.push(`Path is not a file: ${filePath}`);
  }
  
  // Check file size (TinyPNG limit: 500MB)
  const maxSize = 500 * 1024 * 1024; // 500MB in bytes
  if (stats.size > maxSize) {
    errors.push(`File too large: ${formatBytes(stats.size)} (max: ${formatBytes(maxSize)})`);
  }
  
  // Check file is readable
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (err) {
    errors.push(`File not readable: ${filePath}`);
  }
  
  // Check file format by reading file header
  try {
    const header = fs.readFileSync(filePath, { start: 0, end: 12 });
    if (!isValidImageHeader(header, filePath)) {
      errors.push(`Invalid or corrupted image file: ${filePath}`);
    }
  } catch (err) {
    errors.push(`Cannot read file header: ${filePath}`);
  }
  
  return errors;
}

function isValidImageHeader(buffer, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (ext === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && 
           buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  
  // JPEG signature: FF D8 FF
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  
  // WebP signature: RIFF ... WEBP
  if (ext === '.webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && 
           buffer[2] === 0x46 && buffer[3] === 0x46 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 && 
           buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  
  // AVIF signature: ... ftyp ... avif
  if (ext === '.avif') {
    // AVIF has variable signature, basic check for ftyp box
    return buffer[4] === 0x66 && buffer[5] === 0x74 && 
           buffer[6] === 0x79 && buffer[7] === 0x70;
  }
  
  return false; // Unknown format
}
```

### Directory Structure Preservation
```javascript
function preserveDirectoryStructure(files, baseDir, outputDir) {
  const structureMap = new Map();
  
  for (const file of files) {
    const relativePath = path.relative(baseDir, file.path);
    const outputPath = path.join(outputDir, relativePath);
    const outputDirectory = path.dirname(outputPath);
    
    // Ensure output directory exists
    fs.ensureDirSync(outputDirectory);
    
    structureMap.set(file.path, outputPath);
  }
  
  return structureMap;
}

function createOutputStructure(files, options) {
  const structure = {
    backupDir: path.join(options.baseDir, options.backupDirectory || './original'),
    outputDir: options.outputDirectory || options.baseDir,
    fileMappings: []
  };
  
  // Create backup directory
  fs.ensureDirSync(structure.backupDir);
  
  for (const file of files) {
    const relativePath = path.relative(options.baseDir, file.path);
    const backupPath = path.join(structure.backupDir, relativePath);
    const outputPath = path.join(structure.outputDir, relativePath);
    
    // Ensure subdirectories exist
    fs.ensureDirSync(path.dirname(backupPath));
    if (structure.outputDir !== options.baseDir) {
      fs.ensureDirSync(path.dirname(outputPath));
    }
    
    structure.fileMappings.push({
      original: file.path,
      backup: backupPath,
      output: outputPath
    });
  }
  
  return structure;
}
```

## Statistics and Reporting

### Compression Statistics
```javascript
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
    stats.throughput = (stats.successfulFiles / results.processingTime) * 1000; // files per second
  }
  
  // Group by file type
  for (const result of results.successful) {
    const ext = path.extname(result.file).toLowerCase();
    
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
```

### Report Generation
```javascript
function generateCompressionReport(stats, apiKeyUsage) {
  const report = [];
  
  // Header
  report.push('📊 Compression Report');
  report.push('='.repeat(50));
  
  // Summary
  report.push(`\n📁 Files Processed:`);
  report.push(`   Total: ${stats.totalFiles}`);
  report.push(`   Successful: ${stats.successfulFiles} (${stats.successRate.toFixed(1)}%)`);
  report.push(`   Failed: ${stats.failedFiles}`);
  
  // Size statistics
  report.push(`\n💾 Size Statistics:`);
  report.push(`   Original: ${formatBytes(stats.totalOriginalSize)}`);
  report.push(`   Compressed: ${formatBytes(stats.totalCompressedSize)}`);
  report.push(`   Saved: ${formatBytes(stats.totalSavings)} (${stats.averageCompressionRatio.toFixed(1)}%)`);
  
  // Performance
  report.push(`\n⚡ Performance:`);
  report.push(`   Processing Time: ${(stats.processingTime / 1000).toFixed(1)}s`);
  report.push(`   Throughput: ${stats.throughput.toFixed(1)} files/second`);
  
  // By file type
  if (Object.keys(stats.byFileType).length > 0) {
    report.push(`\n📋 By File Type:`);
    
    for (const [ext, typeStats] of Object.entries(stats.byFileType)) {
      const typeRatio = (typeStats.savings / typeStats.originalSize) * 100;
      report.push(`   ${ext.toUpperCase()}: ${typeStats.count} files, ${formatBytes(typeStats.savings)} saved (${typeRatio.toFixed(1)}%)`);
    }
  }
  
  // API usage
  if (apiKeyUsage) {
    report.push(`\n🔑 API Usage:`);
    for (const usage of apiKeyUsage) {
      const remaining = 500 - usage.used;
      report.push(`   ${usage.name}: ${usage.used}/500 compressions (${remaining} remaining)`);
    }
  }
  
  return report.join('\n');
}
```

## Utility Functions

### File Operations Utilities
```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

function isImageFile(filePath) {
  const ext = getFileExtension(filePath);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function sanitizeFilename(filename) {
  // Remove or replace invalid characters for cross-platform compatibility
  return filename.replace(/[<>:"/\\|?*]/g, '_');
}

function getRelativePath(filePath, basePath) {
  return path.relative(basePath, filePath);
}

async function moveFileToBackup(originalPath, backupDir) {
  const filename = path.basename(originalPath);
  const backupPath = path.join(backupDir, filename);
  
  // Ensure backup directory exists
  await fs.ensureDir(backupDir);
  
  // Move file to backup location
  await fs.move(originalPath, backupPath);
  
  return backupPath;
}
```

### Cleanup Functions
```javascript
function cleanupTempFiles(directory) {
  const tempPattern = /\.(tmp|temp)$/;
  
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      if (tempPattern.test(file)) {
        const filePath = path.join(directory, file);
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up temp file: ${file}`);
      }
    }
  } catch (err) {
    console.warn(`Warning: Could not clean temp files: ${err.message}`);
  }
}

function validateBackupIntegrity(originalFiles, backupDir) {
  const issues = [];
  
  for (const file of originalFiles) {
    const filename = path.basename(file.path);
    const backupPath = path.join(backupDir, filename);
    
    if (!fs.existsSync(backupPath)) {
      issues.push(`Missing backup for: ${filename}`);
      continue;
    }
    
    const originalStats = fs.statSync(file.path);
    const backupStats = fs.statSync(backupPath);
    
    if (originalStats.size !== backupStats.size) {
      issues.push(`Size mismatch for: ${filename}`);
    }
  }
  
  return issues;
}
```