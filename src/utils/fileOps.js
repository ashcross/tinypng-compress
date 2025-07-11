import fs from 'fs-extra';
import path from 'path';

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function validateFileForProcessing(filePath) {
  const errors = [];
  
  if (!fs.existsSync(filePath)) {
    errors.push(`File not found: ${filePath}`);
    return errors;
  }
  
  const stats = fs.statSync(filePath);
  
  if (!stats.isFile()) {
    errors.push(`Path is not a file: ${filePath}`);
  }
  
  const maxSize = 500 * 1024 * 1024; // 500MB in bytes
  if (stats.size > maxSize) {
    errors.push(`File too large: ${formatBytes(stats.size)} (max: ${formatBytes(maxSize)})`);
  }
  
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (err) {
    errors.push(`File not readable: ${filePath}`);
  }
  
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    errors.push(`Unsupported format: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }
  
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
  
  if (ext === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && 
           buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  
  if (ext === '.webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && 
           buffer[2] === 0x46 && buffer[3] === 0x46 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 && 
           buffer[10] === 0x42 && buffer[11] === 0x50;
  }
  
  if (ext === '.avif') {
    return buffer[4] === 0x66 && buffer[5] === 0x74 && 
           buffer[6] === 0x79 && buffer[7] === 0x70;
  }
  
  return false;
}

function createBackupDirectory(baseDirectory) {
  const backupPath = path.join(baseDirectory, 'original');
  
  try {
    fs.ensureDirSync(backupPath);
    
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

async function backupFile(filePath, backupDirectory) {
  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDirectory, fileName);
  
  if (fs.existsSync(backupPath)) {
    const originalStat = fs.statSync(filePath);
    const backupStat = fs.statSync(backupPath);
    
    if (originalStat.size === backupStat.size && 
        originalStat.mtime.getTime() === backupStat.mtime.getTime()) {
      return { skipped: true, path: backupPath };
    }
    
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const versionedName = `${base}_${timestamp}${ext}`;
    const versionedPath = path.join(backupDirectory, versionedName);
    
    await fs.copy(filePath, versionedPath, { preserveTimestamps: true });
    return { created: true, path: versionedPath, versioned: true };
  }
  
  await fs.copy(filePath, backupPath, { preserveTimestamps: true });
  return { created: true, path: backupPath };
}

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

export {
  formatBytes,
  validateFileForProcessing,
  createBackupDirectory,
  backupFile,
  scanForImages,
  SUPPORTED_EXTENSIONS
};