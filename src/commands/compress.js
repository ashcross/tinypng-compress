import { loadConfig, saveConfig } from '../config/index.js';
import { compressWithRetry, canCompress } from '../compression/index.js';
import { validateFileForProcessing, createBackupDirectory, backupFile, formatBytes } from '../utils/fileOps.js';
import { handleCompressionError, handleFileSystemError, handleConfigError, formatErrorMessage } from '../utils/errorHandler.js';
import path from 'path';
import tinify from 'tinify';

async function compressFileCommand(filePath, apiKeyName, options = {}) {
  try {
    const config = await loadConfig();
    
    const apiKey = config.apiKeys.find(key => key.name === apiKeyName);
    if (!apiKey) {
      const availableKeys = config.apiKeys.map(k => k.name).join(', ');
      throw new Error(`API key '${apiKeyName}' not found. Available keys: ${availableKeys}`);
    }
    
    const validationErrors = validateFileForProcessing(filePath);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(', '));
    }
    
    canCompress(apiKey, 1);
    
    const fileDirectory = path.dirname(filePath);
    const backupDirectory = createBackupDirectory(fileDirectory);
    
    console.log(`Compressing: ${filePath}`);
    
    const backupResult = await backupFile(filePath, backupDirectory);
    if (backupResult.skipped) {
      console.log(`✓ Backup already exists: ${backupResult.path}`);
    } else {
      console.log(`✓ Original backed up to: ${backupResult.path}`);
    }
    
    const compressionOptions = {
      preserveMetadata: options.preserveMetadata,
      convert: options.convert
    };
    
    const result = await compressWithRetry(filePath, apiKey, compressionOptions);
    
    console.log(`✓ Compressed successfully using API key '${apiKeyName}'`);
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
    console.log(`  ${apiKeyName}: ${apiKey.compressions_used}/500 compressions used (${remaining} remaining)`);
    
    return result;
    
  } catch (err) {
    let errorInfo;
    
    if (err instanceof tinify.AccountError || err instanceof tinify.ClientError || 
        err instanceof tinify.ServerError || err instanceof tinify.ConnectionError) {
      errorInfo = handleCompressionError(err, apiKeyName, filePath);
    } else if (err.code && (err.code.startsWith('E'))) {
      errorInfo = handleFileSystemError(err, filePath);
    } else if (err.message.includes('config') || err.message.includes('API key')) {
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

export default compressFileCommand;