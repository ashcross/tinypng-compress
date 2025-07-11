# Error Handling Specification

## Error Categories

### 1. Configuration Errors

#### Missing Configuration File
```javascript
class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
    this.category = 'configuration';
  }
}

// Usage
if (!fs.existsSync('./tinypng.config.json')) {
  throw new ConfigurationError(
    'Configuration file not found.\n\n' +
    'Suggestion: Run \'tinypng-compress --init\' to create configuration'
  );
}
```

#### Invalid API Key Name
```javascript
function validateApiKeyName(keyName, config) {
  const apiKey = config.apiKeys.find(key => key.name === keyName);
  
  if (!apiKey) {
    const availableKeys = config.apiKeys.map(k => k.name).join(', ');
    throw new ConfigurationError(
      `API key '${keyName}' not found.\n\n` +
      `Available keys: ${availableKeys}\n` +
      `Suggestion: Check key name spelling or run 'tinypng-compress --check' to view all keys`
    );
  }
  
  return apiKey;
}
```

### 2. API Limit Errors

#### Single Key Limit Exceeded
```javascript
class ApiLimitError extends Error {
  constructor(keyName, currentUsage) {
    const nextReset = getNextResetDate();
    
    super(
      `API key '${keyName}' has reached monthly limit (${currentUsage}/500 compressions used).\n\n` +
      `Suggestion: Use a different API key or wait until next month (resets ${nextReset})`
    );
    
    this.name = 'ApiLimitError';
    this.category = 'api_limit';
    this.keyName = keyName;
    this.currentUsage = currentUsage;
  }
}

function getNextResetDate() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}
```

#### Insufficient Compressions for Batch
```javascript
function validateSufficientCompressions(apiKey, fileCount) {
  const remaining = 500 - apiKey.compressions_used;
  
  if (remaining <= 0) {
    throw new ApiLimitError(apiKey.name, apiKey.compressions_used);
  }
  
  if (fileCount > remaining) {
    const suggestion = fileCount <= remaining * 2 
      ? `Consider processing in smaller batches of ${remaining} files`
      : `Consider using --strategy multi-key to distribute across multiple API keys`;
      
    throw new ApiLimitError(
      `API key '${apiKey.name}' has insufficient compressions.\n` +
      `Need: ${fileCount} compressions, Available: ${remaining}\n\n` +
      `Suggestion: ${suggestion}`
    );
  }
}
```

### 3. File System Errors

#### File Not Found
```javascript
class FileSystemError extends Error {
  constructor(message, path, operation) {
    super(message);
    this.name = 'FileSystemError';
    this.category = 'filesystem';
    this.path = path;
    this.operation = operation;
  }
}

function validateFileExists(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new FileSystemError(
      `File not found: ${filepath}\n\n` +
      `Suggestion: Check the file path and ensure the file exists`,
      filepath,
      'read'
    );
  }
}
```

#### Permission Denied
```javascript
function validateFilePermissions(filepath, operation = 'read') {
  try {
    if (operation === 'read') {
      fs.accessSync(filepath, fs.constants.R_OK);
    } else if (operation === 'write') {
      fs.accessSync(path.dirname(filepath), fs.constants.W_OK);
    }
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new FileSystemError(
        `Permission denied: Cannot ${operation} ${filepath}\n\n` +
        `Suggestion: Check file permissions or run with appropriate privileges`,
        filepath,
        operation
      );
    }
    throw err;
  }
}
```

#### Disk Space Check
```javascript
function validateDiskSpace(directory, estimatedSize) {
  try {
    const stats = fs.statSync(directory);
    const free = stats.free || 0;
    
    if (estimatedSize > free) {
      throw new FileSystemError(
        `Insufficient disk space in ${directory}\n` +
        `Required: ${formatBytes(estimatedSize)}, Available: ${formatBytes(free)}\n\n` +
        `Suggestion: Free up disk space or choose a different output directory`,
        directory,
        'write'
      );
    }
  } catch (err) {
    // Disk space check failed, continue with warning
    console.warn(`Warning: Could not check disk space for ${directory}`);
  }
}
```

### 4. TinyPNG API Errors

#### Account Error Handler
```javascript
import tinify from 'tinify';

async function handleTinyPngError(err, apiKey, retryCount = 0) {
  if (err instanceof tinify.AccountError) {
    // Update local usage tracking
    updateKeyUsage(apiKey.name, 500); // Mark as limit reached
    
    throw new ApiLimitError(
      `TinyPNG API Error: ${err.message}\n\n` +
      `Key '${apiKey.name}' may have reached its limit or expired.\n` +
      `Suggestion: Run 'tinypng-compress --check' to verify key status`
    );
  }
  
  if (err instanceof tinify.ClientError) {
    throw new ValidationError(
      `Invalid image file: ${err.message}\n\n` +
      `Suggestion: Ensure file is a valid PNG, JPEG, WebP, or AVIF image`
    );
  }
  
  if (err instanceof tinify.ServerError && retryCount < 3) {
    console.warn(`Server error, retrying in ${(retryCount + 1) * 1000}ms...`);
    await delay((retryCount + 1) * 1000);
    return 'retry';
  }
  
  if (err instanceof tinify.ConnectionError && retryCount < 3) {
    console.warn(`Connection error, retrying in ${(retryCount + 1) * 1000}ms...`);
    await delay((retryCount + 1) * 1000);
    return 'retry';
  }
  
  // Unhandled error
  throw new Error(`TinyPNG API Error: ${err.message}`);
}
```

### 5. Validation Errors

#### Unsupported File Format
```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.category = 'validation';
  }
}

const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];

function validateFileFormat(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new ValidationError(
      `Unsupported file format: ${ext}\n\n` +
      `Supported formats: ${SUPPORTED_FORMATS.join(', ')}\n` +
      `File: ${filepath}`
    );
  }
}
```

#### Empty Directory
```javascript
function validateDirectoryHasImages(dirPath) {
  const files = scanForImages(dirPath);
  
  if (files.length === 0) {
    throw new ValidationError(
      `No supported image files found in: ${dirPath}\n\n` +
      `Supported formats: ${SUPPORTED_FORMATS.join(', ')}\n` +
      `Suggestion: Check directory path or add some image files`
    );
  }
  
  return files;
}
```

## Error Recovery Strategies

### Graceful Degradation
```javascript
async function processFilesWithGracefulHandling(files, apiKey) {
  const results = {
    successful: [],
    failed: [],
    skipped: []
  };
  
  for (const file of files) {
    try {
      await processFile(file, apiKey);
      results.successful.push(file);
      
    } catch (err) {
      if (err instanceof ApiLimitError) {
        // Key reached limit, skip remaining files
        results.skipped = files.slice(files.indexOf(file));
        break;
      } else {
        // Individual file error, continue with others
        results.failed.push({ file, error: err.message });
        console.warn(`Skipping ${file}: ${err.message}`);
      }
    }
  }
  
  return results;
}
```

### Atomic Operations
```javascript
async function atomicFileOperation(originalPath, operation) {
  const backupPath = originalPath + '.backup';
  const tempPath = originalPath + '.tmp';
  
  try {
    // Create backup
    await fs.copyFile(originalPath, backupPath);
    
    // Perform operation to temp file
    await operation(originalPath, tempPath);
    
    // Atomic replace
    await fs.rename(tempPath, originalPath);
    
    // Remove backup on success
    await fs.unlink(backupPath);
    
  } catch (err) {
    // Restore from backup on failure
    try {
      if (fs.existsSync(backupPath)) {
        await fs.copyFile(backupPath, originalPath);
        await fs.unlink(backupPath);
      }
      if (fs.existsSync(tempPath)) {
        await fs.unlink(tempPath);
      }
    } catch (restoreErr) {
      console.error('Critical: Failed to restore backup:', restoreErr.message);
    }
    
    throw err;
  }
}
```

## User-Friendly Error Messages

### Error Formatter
```javascript
function formatError(err) {
  const timestamp = new Date().toLocaleString();
  
  let output = `\n❌ Error: ${err.message}\n`;
  
  // Add category-specific guidance
  switch (err.category) {
    case 'configuration':
      output += `\n💡 Configuration Help:`;
      output += `\n   • Run 'tinypng-compress --init' to set up configuration`;
      output += `\n   • Use 'tinypng-compress --check' to verify API keys`;
      break;
      
    case 'api_limit':
      output += `\n💡 API Limit Help:`;
      output += `\n   • Check usage: 'tinypng-compress --check'`;
      output += `\n   • API limits reset on the 1st of each month`;
      output += `\n   • Consider upgrading to paid plan for unlimited use`;
      break;
      
    case 'filesystem':
      output += `\n💡 File System Help:`;
      output += `\n   • Ensure sufficient disk space`;
      output += `\n   • Check file/directory permissions`;
      output += `\n   • Verify paths are correct`;
      break;
      
    case 'validation':
      output += `\n💡 Validation Help:`;
      output += `\n   • Supported formats: PNG, JPEG, WebP, AVIF`;
      output += `\n   • Check file is not corrupted`;
      output += `\n   • Ensure file size is under 500MB`;
      break;
  }
  
  if (process.env.NODE_ENV === 'development') {
    output += `\n\n🔍 Debug Info:`;
    output += `\n   Time: ${timestamp}`;
    output += `\n   Stack: ${err.stack}`;
  }
  
  return output;
}
```

### Progress Error Handling
```javascript
function createProgressHandler(totalFiles) {
  let processed = 0;
  let errors = 0;
  
  return {
    onSuccess: (file) => {
      processed++;
      console.log(`✓ ${processed}/${totalFiles}: ${path.basename(file)}`);
    },
    
    onError: (file, err) => {
      processed++;
      errors++;
      console.log(`✗ ${processed}/${totalFiles}: ${path.basename(file)} - ${err.message}`);
    },
    
    onComplete: () => {
      const successful = processed - errors;
      console.log(`\n📊 Summary: ${successful} successful, ${errors} failed, ${totalFiles} total`);
      
      if (errors > 0) {
        console.log(`\n💡 ${errors} files failed. Check error messages above for details.`);
      }
    }
  };
}
```

## Exit Codes

### Standard Exit Codes
```javascript
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  CONFIG_ERROR: 2,
  API_LIMIT_ERROR: 3,
  FILE_ERROR: 4,
  VALIDATION_ERROR: 5,
  NETWORK_ERROR: 6
};

function exitWithCode(err) {
  if (!err) {
    process.exit(EXIT_CODES.SUCCESS);
  }
  
  console.error(formatError(err));
  
  switch (err.category) {
    case 'configuration':
      process.exit(EXIT_CODES.CONFIG_ERROR);
    case 'api_limit':
      process.exit(EXIT_CODES.API_LIMIT_ERROR);
    case 'filesystem':
      process.exit(EXIT_CODES.FILE_ERROR);
    case 'validation':
      process.exit(EXIT_CODES.VALIDATION_ERROR);
    default:
      process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}
```

### Cleanup on Exit
```javascript
process.on('SIGINT', () => {
  console.log('\n⚠️  Operation interrupted by user');
  cleanup();
  process.exit(130); // Standard exit code for Ctrl+C
});

process.on('uncaughtException', (err) => {
  console.error('💥 Unexpected error:', err.message);
  cleanup();
  process.exit(EXIT_CODES.GENERAL_ERROR);
});

function cleanup() {
  // Remove temporary files
  // Unlock any file operations
  // Save current progress
  console.log('🧹 Cleaning up temporary files...');
}