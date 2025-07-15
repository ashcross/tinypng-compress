import { loadConfig, saveConfig } from '../config/index.js';
import { compressWithRetry, canCompress } from '../compression/index.js';
import { validateFileForProcessing, createBackupDirectory, backupFile, formatBytes } from '../utils/fileOps.js';
import { handleCompressionError, handleFileSystemError, handleConfigError, formatErrorMessage } from '../utils/errorHandler.js';
import { validateApiKeySelection } from '../utils/apiKeySelector.js';
import { determineOutputFormat, validateFormat, getConvertDescription } from '../utils/formatHelper.js';
import path from 'path';
import tinify from 'tinify';

async function compressFileCommand(filePath, apiKeyName, options = {}) {
  // Resolve file path to absolute path for consistent handling
  const resolvedFilePath = path.resolve(filePath);
  
  try {
    const config = await loadConfig();
    
    // Validate format option
    validateFormat(options.convert);
    
    // Validate file
    const validationErrors = validateFileForProcessing(resolvedFilePath);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }
    
    // Smart API key selection
    const apiKey = await validateApiKeySelection(apiKeyName, config, 1);
    
    canCompress(apiKey, 1);
    
    const backupDirectory = createBackupDirectory(resolvedFilePath);
    
    console.log(`Compressing: ${filePath}`);
    console.log(`Using API key: ${apiKey.name}`);
    console.log(`Action: ${getConvertDescription(options.convert, resolvedFilePath)}`);
    
    const backupResult = await backupFile(resolvedFilePath, backupDirectory);
    if (backupResult.skipped) {
      console.log(`✓ Backup already exists: ${backupResult.path}`);
    } else {
      console.log(`✓ Original backed up to: ${backupResult.path}`);
    }
    
    // Determine actual conversion format
    const actualConvertFormat = determineOutputFormat(resolvedFilePath, options.convert);
    
    const compressionOptions = {
      preserveMetadata: options.preserveMetadata,
      convert: actualConvertFormat
    };
    
    const result = await compressWithRetry(resolvedFilePath, apiKey, compressionOptions);
    
    console.log(`✓ Compressed successfully using API key '${apiKey.name}'`);
    if (actualConvertFormat && result.outputPath !== resolvedFilePath) {
      console.log(`✓ Converted to ${actualConvertFormat.toUpperCase()} format: ${result.outputPath}`);
    }
    console.log('');
    console.log('File Statistics:');
    console.log(`  Original:   ${formatBytes(result.originalSize)}`);
    console.log(`  Compressed: ${formatBytes(result.compressedSize)}`);
    console.log(`  Savings:    ${result.compressionRatio}% (${formatBytes(result.savings)} saved)`);
    console.log('');
    
    apiKey.compressions_used = result.compressionCount;
    
    await saveConfig(config);
    
    const remaining = 500 - apiKey.compressions_used;
    console.log('API Key Usage:');
    console.log(`  ${apiKey.name}: ${apiKey.compressions_used}/500 compressions used (${remaining} remaining)`);
    
    return result;
    
  } catch (err) {
    let errorInfo;
    
    if (err instanceof tinify.AccountError || err instanceof tinify.ClientError || 
        err instanceof tinify.ServerError || err instanceof tinify.ConnectionError) {
      errorInfo = handleCompressionError(err, apiKeyName || 'auto-selected', resolvedFilePath);
    } else if (err.code && (err.code.startsWith('E'))) {
      errorInfo = handleFileSystemError(err, resolvedFilePath);
    } else if (err.message.includes('Configuration file not found') || err.message.includes('Configuration file contains invalid JSON')) {
      errorInfo = handleConfigError(err);
    } else if (err.message.includes('API key') && err.message.includes('not found') && err.message.includes('Available keys:')) {
      // Handle API key not found specifically
      errorInfo = {
        type: 'API_KEY_NOT_FOUND',
        message: err.message,
        suggestion: `Check available API keys with 'tinypng-compress --check' or add a new key with 'tinypng-compress --new-key'`
      };
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

export default compressFileCommand;