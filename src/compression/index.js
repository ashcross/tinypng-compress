import tinify from 'tinify';
import fs from 'fs-extra';
import path from 'path';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function compressFile(inputPath, apiKey, options = {}) {
  tinify.key = apiKey.key;
  
  const startTime = Date.now();
  const originalSize = fs.statSync(inputPath).size;
  
  try {
    const source = tinify.fromFile(inputPath);
    
    let processedSource = source;
    
    if (options.resize) {
      processedSource = source.resize(options.resize);
    }
    
    if (options.convert) {
      // Map format short names to MIME types
      const formatMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'avif': 'image/avif'
      };
      
      const mimeType = formatMap[options.convert.toLowerCase()] || options.convert;
      const convertOptions = { type: mimeType };
      
      if (options.background) {
        convertOptions.transform = { background: options.background };
      }
      processedSource = source.convert(convertOptions);
    }
    
    if (options.preserveMetadata) {
      processedSource = processedSource.preserve("copyright", "creation", "location");
    }
    
    const tempPath = inputPath + '.tmp';
    await processedSource.toFile(tempPath);
    
    const compressedSize = fs.statSync(tempPath).size;
    
    // Determine output path based on conversion
    let outputPath = inputPath;
    if (options.convert) {
      const parsedPath = path.parse(inputPath);
      const newExtension = options.convert.toLowerCase() === 'jpeg' ? '.jpg' : `.${options.convert.toLowerCase()}`;
      outputPath = path.join(parsedPath.dir, parsedPath.name + newExtension);
    }
    
    await fs.move(tempPath, outputPath, { overwrite: true });
    
    // If format conversion occurred, remove the original file
    if (options.convert && inputPath !== outputPath) {
      try {
        await fs.unlink(inputPath);
      } catch (err) {
        console.warn(`Warning: Could not remove original file ${inputPath}: ${err.message}`);
      }
    }
    
    const processingTime = Date.now() - startTime;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    
    return {
      success: true,
      originalSize,
      compressedSize,
      savings: originalSize - compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      processingTime,
      compressionCount: tinify.compressionCount,
      outputPath
    };
    
  } catch (err) {
    const tempPath = inputPath + '.tmp';
    if (fs.existsSync(tempPath)) {
      await fs.unlink(tempPath);
    }
    throw err;
  }
}

async function compressWithRetry(inputPath, apiKey, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await compressFile(inputPath, apiKey, options);
    } catch (err) {
      if (err instanceof tinify.AccountError) {
        throw err;
      } else if (err instanceof tinify.ClientError) {
        throw err;
      } else if (attempt === maxRetries) {
        throw err;
      } else {
        await delay(1000 * attempt);
      }
    }
  }
}

function validateApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    tinify.key = apiKey;
    tinify.validate((err) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          valid: true,
          compressionCount: tinify.compressionCount
        });
      }
    });
  });
}

function canCompress(apiKeyConfig, filesToProcess = 1) {
  const remaining = 500 - apiKeyConfig.compressions_used;
  
  if (remaining <= 0) {
    throw new Error(`API key '${apiKeyConfig.name}' has reached monthly limit (500/500 used)`);
  }
  
  if (filesToProcess > remaining) {
    console.warn(`Warning: ${filesToProcess} files to process, but only ${remaining} compressions remaining`);
  }
  
  return remaining;
}

export {
  compressFile,
  compressWithRetry,
  validateApiKey,
  canCompress
};