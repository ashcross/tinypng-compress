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

export {
  handleCompressionError,
  handleFileSystemError,
  handleConfigError,
  formatErrorMessage
};