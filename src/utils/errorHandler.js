import tinify from 'tinify';

function handleCompressionError(err, apiKeyName, filePath) {
  if (err instanceof tinify.AccountError) {
    if (err.message.includes('limit') || err.message.includes('exceed')) {
      return {
        type: 'API_LIMIT',
        message: `API key '${apiKeyName}' has reached monthly limit (500/500 compressions used)`,
        suggestion: `Use a different API key or wait until next month. Check available keys with 'tinypng-compress --check'`
      };
    } else if (err.message.includes('credentials') || err.message.includes('key')) {
      return {
        type: 'INVALID_KEY',
        message: `API key '${apiKeyName}' is invalid or expired`,
        suggestion: `Check your API key configuration with 'tinypng-compress --check'`
      };
    } else {
      return {
        type: 'ACCOUNT_ERROR',
        message: `API key error: ${err.message}`,
        suggestion: `Contact TinyPNG support or check your account status`
      };
    }
  } else if (err instanceof tinify.ClientError) {
    return {
      type: 'FILE_ERROR',
      message: `File format error: ${err.message}`,
      suggestion: `Ensure '${filePath}' is a valid image file in supported format (PNG, JPEG, WebP, AVIF)`
    };
  } else if (err instanceof tinify.ServerError) {
    return {
      type: 'SERVER_ERROR',
      message: `TinyPNG server error: ${err.message}`,
      suggestion: `This is a temporary issue. Please try again in a few minutes.`
    };
  } else if (err instanceof tinify.ConnectionError) {
    return {
      type: 'NETWORK_ERROR',
      message: `Network error: ${err.message}`,
      suggestion: `Check your internet connection and try again.`
    };
  } else {
    return {
      type: 'UNKNOWN_ERROR',
      message: err.message,
      suggestion: `If this issue persists, please check the documentation or file an issue.`
    };
  }
}

function handleFileSystemError(err, filePath) {
  if (err.code === 'ENOENT') {
    return {
      type: 'FILE_NOT_FOUND',
      message: `File not found: ${filePath}`,
      suggestion: `Check that the file path is correct and the file exists.`
    };
  } else if (err.code === 'EACCES') {
    return {
      type: 'PERMISSION_ERROR',
      message: `Permission denied: ${filePath}`,
      suggestion: `Check file permissions or run with appropriate privileges.`
    };
  } else if (err.code === 'ENOSPC') {
    return {
      type: 'DISK_SPACE_ERROR',
      message: `Insufficient disk space`,
      suggestion: `Free up disk space and try again.`
    };
  } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
    return {
      type: 'FILE_LIMIT_ERROR',
      message: `Too many open files`,
      suggestion: `Close other applications and try again.`
    };
  } else {
    return {
      type: 'FILESYSTEM_ERROR',
      message: `File system error: ${err.message}`,
      suggestion: `Check file paths and permissions.`
    };
  }
}

function handleConfigError(err) {
  if (err.message.includes('not found')) {
    return {
      type: 'CONFIG_NOT_FOUND',
      message: `Configuration file not found`,
      suggestion: `Run 'tinypng-compress --init' to create a configuration file.`
    };
  } else if (err.message.includes('invalid') || err.message.includes('parse')) {
    return {
      type: 'CONFIG_INVALID',
      message: `Configuration file is invalid or corrupted`,
      suggestion: `Run 'tinypng-compress --init' to recreate the configuration file.`
    };
  } else {
    return {
      type: 'CONFIG_ERROR',
      message: `Configuration error: ${err.message}`,
      suggestion: `Check your configuration file or recreate it with 'tinypng-compress --init'.`
    };
  }
}

function formatErrorMessage(errorInfo) {
  const lines = [];
  lines.push(`Error: ${errorInfo.message}`);
  lines.push('');
  lines.push(`Suggestion: ${errorInfo.suggestion}`);
  return lines.join('\n');
}

function handleBatchError(err, context = {}) {
  const { fileName, currentFile, totalFiles, apiKeyName } = context;
  
  if (err instanceof tinify.AccountError) {
    return {
      type: 'BATCH_API_LIMIT',
      message: `API key '${apiKeyName}' reached limit while processing ${fileName} (${currentFile}/${totalFiles})`,
      suggestion: `Remaining files will be skipped. Use 'tinypng-compress --check' to verify key status or switch to a different API key.`,
      recoverable: false
    };
  } else if (err instanceof tinify.ClientError) {
    return {
      type: 'BATCH_FILE_ERROR',
      message: `File format error in ${fileName}: ${err.message}`,
      suggestion: `Skipping this file and continuing with remaining files.`,
      recoverable: true
    };
  } else if (err instanceof tinify.ServerError) {
    return {
      type: 'BATCH_SERVER_ERROR',
      message: `TinyPNG server error while processing ${fileName}: ${err.message}`,
      suggestion: `Retrying with exponential backoff. If problem persists, this file will be skipped.`,
      recoverable: true
    };
  } else if (err instanceof tinify.ConnectionError) {
    return {
      type: 'BATCH_NETWORK_ERROR',
      message: `Network error while processing ${fileName}: ${err.message}`,
      suggestion: `Retrying with exponential backoff. Check network connection.`,
      recoverable: true
    };
  } else if (err.message.includes('Circuit breaker')) {
    return {
      type: 'BATCH_CIRCUIT_BREAKER',
      message: `Circuit breaker activated after multiple failures`,
      suggestion: `Pausing batch processing to prevent further issues. Will retry after cooldown period.`,
      recoverable: true
    };
  } else if (err.message.includes('memory')) {
    return {
      type: 'BATCH_MEMORY_ERROR',
      message: `Memory pressure detected during batch processing`,
      suggestion: `Reducing concurrency to manage memory usage. Consider processing in smaller batches.`,
      recoverable: true
    };
  } else {
    return {
      type: 'BATCH_UNKNOWN_ERROR',
      message: `Unknown error while processing ${fileName}: ${err.message}`,
      suggestion: `Skipping this file and continuing with batch processing.`,
      recoverable: true
    };
  }
}

function formatBatchErrorSummary(errors, totalFiles) {
  if (errors.length === 0) return '';
  
  const lines = [];
  lines.push(`\n❌ Batch Processing Errors (${errors.length}/${totalFiles} files failed):`);
  lines.push('─'.repeat(60));
  
  const errorsByType = errors.reduce((acc, error) => {
    const type = error.reason || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(error);
    return acc;
  }, {});
  
  for (const [type, typeErrors] of Object.entries(errorsByType)) {
    lines.push(`\n${type.toUpperCase()} (${typeErrors.length} files):`);
    typeErrors.slice(0, 5).forEach(error => {
      const fileName = error.file ? error.file.split('/').pop() : 'unknown';
      lines.push(`  • ${fileName}: ${error.error}`);
    });
    
    if (typeErrors.length > 5) {
      lines.push(`  ... and ${typeErrors.length - 5} more files`);
    }
  }
  
  // Add recovery suggestions
  lines.push('\n💡 Recovery Suggestions:');
  
  if (errorsByType['AccountError'] || errorsByType['limit_reached']) {
    lines.push('  • API limit reached: Use --check to verify key status');
    lines.push('  • Consider using multiple API keys for large batches');
  }
  
  if (errorsByType['ClientError'] || errorsByType['unknown']) {
    lines.push('  • File format errors: Check image file integrity');
    lines.push('  • Run validation on failed files individually');
  }
  
  if (errorsByType['ServerError'] || errorsByType['ConnectionError']) {
    lines.push('  • Network/server errors: Retry batch processing');
    lines.push('  • Consider reducing concurrency with --max-concurrent');
  }
  
  return lines.join('\n');
}

function aggregateBatchErrors(results) {
  const summary = {
    totalFiles: results.successful.length + results.failed.length,
    successful: results.successful.length,
    failed: results.failed.length,
    successRate: 0,
    errorBreakdown: {},
    recoverableErrors: 0,
    fatalErrors: 0
  };
  
  if (summary.totalFiles > 0) {
    summary.successRate = (summary.successful / summary.totalFiles) * 100;
  }
  
  results.failed.forEach(failure => {
    const errorType = failure.reason || 'unknown';
    if (!summary.errorBreakdown[errorType]) {
      summary.errorBreakdown[errorType] = 0;
    }
    summary.errorBreakdown[errorType]++;
    
    // Categorize errors as recoverable or fatal
    if (['ClientError', 'ServerError', 'ConnectionError'].includes(errorType)) {
      summary.recoverableErrors++;
    } else {
      summary.fatalErrors++;
    }
  });
  
  return summary;
}

export {
  handleCompressionError,
  handleFileSystemError,
  handleConfigError,
  formatErrorMessage,
  handleBatchError,
  formatBatchErrorSummary,
  aggregateBatchErrors
};