import path from 'path';

const SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'avif'];
const FORMAT_EXTENSIONS = {
  'png': '.png',
  'jpg': '.jpg', 
  'jpeg': '.jpg',
  'webp': '.webp',
  'avif': '.avif'
};

/**
 * Determine the output format based on input file and convert option
 * @param {string} inputPath - Path to input file
 * @param {string} convertOption - Convert option ('auto', format name, or null/undefined)
 * @returns {string|null} Format to convert to, or null for no conversion
 */
function determineOutputFormat(inputPath, convertOption) {
  // No conversion specified - maintain original format
  if (!convertOption) {
    return null;
  }
  
  // Auto mode - maintain original format
  if (convertOption === 'auto') {
    return null;
  }
  
  // Specific format requested
  const format = convertOption.toLowerCase();
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error(`Unsupported format: ${format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
  }
  
  return format;
}

/**
 * Get file extension from file path
 * @param {string} filePath - Path to file
 * @returns {string} File extension without dot (e.g., 'jpg', 'png')
 */
function getFileExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

/**
 * Get original format of input file
 * @param {string} inputPath - Path to input file
 * @returns {string} Original format (e.g., 'jpg', 'png')
 */
function getOriginalFormat(inputPath) {
  return getFileExtension(inputPath);
}

/**
 * Check if conversion is needed based on input and output formats
 * @param {string} inputPath - Path to input file
 * @param {string} convertOption - Convert option
 * @returns {boolean} True if conversion is needed
 */
function isConversionNeeded(inputPath, convertOption) {
  const outputFormat = determineOutputFormat(inputPath, convertOption);
  
  // No conversion if output format is null
  if (!outputFormat) {
    return false;
  }
  
  const originalFormat = getOriginalFormat(inputPath);
  
  // Handle jpeg/jpg equivalency
  const normalizedOriginal = originalFormat === 'jpeg' ? 'jpg' : originalFormat;
  const normalizedOutput = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
  
  return normalizedOriginal !== normalizedOutput;
}

/**
 * Generate output file path based on conversion settings
 * @param {string} inputPath - Path to input file
 * @param {string} convertOption - Convert option
 * @returns {string} Output file path
 */
function generateOutputPath(inputPath, convertOption) {
  const outputFormat = determineOutputFormat(inputPath, convertOption);
  
  // No conversion - return original path
  if (!outputFormat) {
    return inputPath;
  }
  
  const parsedPath = path.parse(inputPath);
  const newExtension = FORMAT_EXTENSIONS[outputFormat];
  
  return path.join(parsedPath.dir, parsedPath.name + newExtension);
}

/**
 * Validate format option
 * @param {string} format - Format to validate
 * @returns {boolean} True if valid
 * @throws {Error} If invalid format
 */
function validateFormat(format) {
  if (!format) {
    return true; // No format is valid (no conversion)
  }
  
  if (format === 'auto') {
    return true; // Auto is valid
  }
  
  const normalizedFormat = format.toLowerCase();
  if (!SUPPORTED_FORMATS.includes(normalizedFormat)) {
    throw new Error(`Unsupported format: ${format}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}, auto`);
  }
  
  return true;
}

/**
 * Get user-friendly description of convert option
 * @param {string} convertOption - Convert option
 * @param {string} inputPath - Path to input file (for auto mode)
 * @returns {string} Description of what will happen
 */
function getConvertDescription(convertOption, inputPath) {
  if (!convertOption) {
    return 'Compress without format conversion';
  }
  
  if (convertOption === 'auto') {
    const originalFormat = getOriginalFormat(inputPath);
    return `Compress maintaining original format (${originalFormat.toUpperCase()})`;
  }
  
  return `Compress and convert to ${convertOption.toUpperCase()}`;
}

export {
  determineOutputFormat,
  getFileExtension,
  getOriginalFormat,
  isConversionNeeded,
  generateOutputPath,
  validateFormat,
  getConvertDescription,
  SUPPORTED_FORMATS
};