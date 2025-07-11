# TinyPNG API Reference

## Official Node.js Client

### Installation
```bash
npm install --save tinify
```

### Basic Usage
```javascript
import tinify from "tinify";
import fs from "fs";

tinify.key = "YOUR_API_KEY";

// Compress from file
const source = tinify.fromFile("unoptimized.jpg");
source.toFile("optimized.jpg");

// Compress from buffer
fs.readFile("unoptimized.jpg", function(err, sourceData) {
  if (err) throw err;
  tinify.fromBuffer(sourceData).toBuffer(function(err, resultData) {
    if (err) throw err;
    // resultData contains compressed image
  });
});
```

## Authentication & Validation

### API Key Setup
```javascript
tinify.key = "YOUR_API_KEY";

// Validate key before use
tinify.validate(function(err) {
  if (err) {
    // Invalid key or network issue
    console.error("API key validation failed:", err.message);
  } else {
    // Key is valid and can be used
    console.log("API key is valid");
  }
});
```

### Compression Count Tracking
```javascript
// Get current month's usage (available after validation or compression)
let compressionsThisMonth = tinify.compressionCount;
console.log(`Used: ${compressionsThisMonth}/500 compressions this month`);
```

## Error Types

### AccountError
- **Cause**: Invalid API key or account issues
- **Common**: API key reached 500 compression limit
- **Action**: Check key validity, wait for next month, or upgrade account

```javascript
if (err instanceof tinify.AccountError) {
  console.log("Account issue:", err.message);
  // Check if limit reached: typically "Compression limit exceeded"
}
```

### ClientError  
- **Cause**: Invalid request data
- **Common**: Unsupported file format, corrupted image
- **Action**: Validate input file, check file format

### ServerError
- **Cause**: Temporary TinyPNG API issues  
- **Action**: Safe to retry after delay

### ConnectionError
- **Cause**: Network connectivity issues
- **Action**: Check internet connection, safe to retry

## Supported Formats

### Input Formats
- **AVIF**: .avif
- **WebP**: .webp  
- **JPEG**: .jpg, .jpeg
- **PNG**: .png

### File Limitations
- **Max file size**: 500MB
- **Max canvas size**: 256MP (16000px × 16000px)

## Rate Limiting

### API Limits
- **Free tier**: 500 compressions per month per API key
- **Rate limit**: Generous but unspecified - add delays for consecutive requests
- **Concurrent requests**: Not specified, recommend max 3 simultaneous

### Best Practices
```javascript
// Add delay between requests to respect rate limits
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Example usage in batch processing
for (const file of files) {
  await processFile(file);
  await delay(100); // 100ms delay between requests
}
```

## Monthly Reset Behavior

### Compression Count Reset
- **Reset date**: 1st of each month (user's account timezone)
- **Tracking**: `last_reset` field should be updated monthly
- **Detection**: Compare current month/year with stored reset date

### Implementation Example
```javascript
function isNewMonth(lastReset) {
  const now = new Date();
  const reset = new Date(lastReset);
  
  return now.getMonth() !== reset.getMonth() || 
         now.getFullYear() !== reset.getFullYear();
}

function resetUsageIfNeeded(apiKeyConfig) {
  if (isNewMonth(apiKeyConfig.last_reset)) {
    apiKeyConfig.compressions_used = 0;
    apiKeyConfig.last_reset = new Date().toISOString().split('T')[0];
    return true; // Config updated
  }
  return false;
}
```

## Error Recovery Patterns

### Robust Compression Function
```javascript
async function compressWithRetry(inputPath, outputPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const source = tinify.fromFile(inputPath);
      await source.toFile(outputPath);
      return { success: true, compressionCount: tinify.compressionCount };
      
    } catch (err) {
      if (err instanceof tinify.AccountError) {
        // Don't retry account errors (invalid key, limit reached)
        throw err;
      } else if (err instanceof tinify.ClientError) {
        // Don't retry client errors (bad file format)
        throw err;
      } else if (attempt === maxRetries) {
        // Final attempt failed
        throw err;
      } else {
        // Server/Connection error - retry with delay
        await delay(1000 * attempt); // Exponential backoff
      }
    }
  }
}
```

## Usage Validation

### Pre-compression Checks
```javascript
function canCompress(apiKeyConfig, filesToProcess) {
  const remaining = 500 - apiKeyConfig.compressions_used;
  
  if (remaining <= 0) {
    throw new Error(`API key '${apiKeyConfig.name}' has reached monthly limit (500/500 used)`);
  }
  
  if (filesToProcess.length > remaining) {
    console.warn(`Warning: ${filesToProcess.length} files to process, but only ${remaining} compressions remaining`);
  }
  
  return remaining;
}
```

## Integration Notes

### Async/Promise Support
The tinify library supports both callbacks and promises. For modern Node.js development, use async/await:

```javascript
// Promise-based approach (recommended)
try {
  const source = tinify.fromFile("input.jpg");
  await source.toFile("output.jpg");
  console.log("Compression successful");
} catch (err) {
  console.error("Compression failed:", err.message);
}
```

### Memory Management
For large batches, process files sequentially to avoid memory issues:

```javascript
// Process files one at a time
for (const file of largeFileList) {
  await compressFile(file);
  // Memory is freed between iterations
}
```