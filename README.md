# TinyPNG Local Compression Tool

A sophisticated Node.js CLI tool for batch image compression using the TinyPNG API with intelligent API key management, concurrent processing, and smart automation features.

## Features

### 🚀 Core Capabilities
- **Batch Processing**: Compress single files or entire directories with concurrent processing (3-5x faster)
- **Smart API Key Management**: Automatic key selection based on available compression quota
- **Format Conversion**: Convert between PNG, JPEG, WebP, and AVIF formats during compression
- **Intelligent Defaults**: Simplified commands that work without explicit configuration
- **Automatic Backups**: Safe compression with automatic backup to `./original/` directory
- **Progress Tracking**: Real-time progress bars with savings calculations and performance metrics

### 🎯 Smart Automation
- **Auto API Key Selection**: `--api-key any` automatically chooses the key with most available compressions
- **Format Auto-Detection**: `--convert auto` maintains original file formats during compression
- **Monthly Usage Reset**: Automatic tracking and reset of API key usage limits
- **Recursive Processing**: Deep directory scanning with `--recursive` flag

### ⚡ Performance & Reliability
- **Concurrent Processing**: Intelligent rate limiting with 3-5 simultaneous API requests
- **Memory Efficiency**: Handles large file batches without memory overload
- **Error Recovery**: Automatic retry with exponential backoff
- **Circuit Breaker**: Fault tolerance preventing cascading failures

## Installation

### Global Installation
```bash
npm install -g .
```

### Development Setup
```bash
npm install
```

## Quick Start

### 1. Create your tinypng API key
Login using your email address and create a free API key
https://tinypng.com/

### 2. Initialize Configuration
Create your configuration file with API keys:
```bash
tinypng-compress --init
```

### 3. Basic Usage Examples

#### Compress a Directory (Simplified)
```bash
# Auto-selects best API key, maintains original formats
tinypng-compress --dir ./images

# Convert all images to WebP format
tinypng-compress --dir ./images --convert webp

# Recursive directory processing
tinypng-compress --dir ./photos --recursive
```

#### Compress Single File
```bash
# Auto-selects API key
tinypng-compress --file image.jpg

# Specific API key and format conversion
tinypng-compress --file photo.png --api-key my-key --convert webp
```

## Command Reference

### Configuration Commands

#### `--init`
Interactive setup to create configuration file with API key validation:
```bash
tinypng-compress --init
```

#### `--new-key`
Add additional API keys to existing configuration:
```bash
tinypng-compress --new-key
```

#### `--check`
Display API key usage status and monthly limits:
```bash
tinypng-compress --check
```

### Compression Commands

#### Single File Compression
```bash
tinypng-compress --file <path> [options]
```

**Examples:**
```bash
# Basic compression
tinypng-compress --file photo.jpg

# With specific API key
tinypng-compress --file image.png --api-key production-key

# Convert format during compression
tinypng-compress --file picture.jpg --convert webp

# Preserve metadata
tinypng-compress --file photo.jpg --preserve-metadata
```

#### Directory Compression
```bash
tinypng-compress --dir <path> [options]
```

**Examples:**
```bash
# Compress all images in directory
tinypng-compress --dir ./images

# Recursive processing
tinypng-compress --dir ./photos --recursive

# Convert all to WebP
tinypng-compress --dir ./images --convert webp --recursive

# Use specific API key
tinypng-compress --dir ./assets --api-key backup-key
```

## Options Reference

### API Key Selection
- `--api-key <name>`: Use specific API key
- `--api-key any`: Auto-select key with most available compressions
- *No flag*: Auto-selects best available key (default behavior)

### Format Conversion
- `--convert png`: Convert to PNG format
- `--convert jpg`: Convert to JPEG format  
- `--convert webp`: Convert to WebP format
- `--convert avif`: Convert to AVIF format
- `--convert auto`: Maintain original format (default behavior)
- *No flag*: No format conversion

### Processing Options
- `--recursive`: Include subdirectories when processing directories
- `--preserve-metadata`: Keep EXIF data during compression

### Size Options
- `--max-side auto`: Choose the 'side' that should be judged for --max-size: width, height, auto
- `--max-size 1920`: If image is >1920px then resize to 1920px

## Configuration

### Configuration File Location
The tool creates `tinypng.config.json` in your project directory with the following structure:

```json
{
  "version": "1.0.0",
  "apiKeys": [
    {
      "name": "primary",
      "key": "your-api-key-here",
      "email": "your-email@example.com",
      "compressions_used": 0,
      "last_reset": "2024-01-01",
      "status": "active"
    }
  ],
  "compression": {
    "preserve_metadata": false,
    "convert_format": "auto",
    "quality": "auto",
    "resize": null
  },
  "defaults": {
    "api_key_selection": "auto",
    "convert_format": "auto"
  },
  "output": {
    "create_backup": true,
    "backup_directory": "./original",
    "output_directory": "./",
    "preserve_structure": true,
    "overwrite_existing": false
  },
  "advanced": {
    "max_concurrent": 3,
    "retry_attempts": 3,
    "request_delay": 100
  }
}
```

### API Key Management
- **Monthly Limits**: Each TinyPNG API key provides 500 free compressions per month
- **Automatic Reset**: Usage counters reset automatically each month
- **Smart Selection**: Tool automatically chooses keys with available quota
- **Status Tracking**: Real-time monitoring of usage and limits

## File Operations

### Backup System
- **Automatic Backups**: All original files are backed up to `./original/` before compression
- **Duplicate Detection**: Existing backups are not overwritten
- **Versioned Backups**: Multiple backups get timestamp suffixes
- **Safety First**: Compression only proceeds after successful backup

### Supported Formats
- **Input**: PNG, JPEG, WebP, AVIF
- **Output**: PNG, JPEG, WebP, AVIF
- **Conversion**: Any format can be converted to any other supported format
- **Note**: HEIC is not currently supported by the Tinify API, but is in development. Manually convert to a supported format first.

## Performance Features

### Concurrent Processing
- **Intelligent Throttling**: 3-5 simultaneous API requests with adaptive rate limiting
- **Memory Management**: Efficient processing of large file batches
- **Progress Tracking**: Real-time progress bars with ETA and throughput metrics

### Example Output
```
Scanning directory: ./images
Found 150 supported image files
Total size: 45.2 MB

Using API key: production (auto-selected)
Action: Compress maintaining original format (AUTO)
✓ 347 compressions available

Creating backup directory: ./images/original
✓ Backup completed: 150 new, 0 skipped, 0 versioned

Compressing |████████████████████| 100% | 150/150 | Completed! | Saved: 23.1 MB | Concurrent: 0

📊 Compression Report
==================================================

📁 Files Processed:
   Total: 150
   Successful: 150 (100.0%)
   Failed: 0

💾 Size Statistics:
   Original: 45.2 MB
   Compressed: 22.1 MB
   Saved: 23.1 MB (51.1%)

⚡ Performance:
   Processing Time: 47.3s
   Throughput: 3.2 files/second

🔑 API Key Usage:
   production: 150/500 compressions used (350 remaining)
```

## Error Handling

The tool provides comprehensive error handling with actionable suggestions:

### Common Scenarios
- **API Limit Exceeded**: Automatically suggests alternative keys or monthly reset info
- **Invalid API Keys**: Provides validation errors with setup instructions
- **File System Errors**: Clear messages for permission issues, disk space, etc.
- **Network Issues**: Retry mechanisms with exponential backoff

### Example Error Messages
```bash
Error: API key 'main-key' has reached monthly limit (500/500).
Suggestion: Use a different API key or wait for monthly reset on 2024-02-01
Available keys with capacity: backup-key (245 remaining)
```

## Development

### Project Structure
```
tinypng-compress/
├── src/
│   ├── commands/          # Command handlers
│   │   ├── compress.js    # Single file compression
│   │   ├── compressDir.js # Directory compression
│   │   ├── check.js       # Usage status
│   │   ├── init.js        # Configuration setup
│   │   └── new-key.js     # Add API keys
│   ├── compression/       # TinyPNG API logic
│   │   ├── index.js       # Core compression functions
│   │   └── batchProcessor.js # Concurrent processing
│   ├── config/           # Configuration management
│   │   └── index.js      # Config validation and persistence
│   ├── utils/            # Utilities
│   │   ├── apiKeySelector.js # Smart API key selection
│   │   ├── formatHelper.js   # Format conversion logic
│   │   ├── fileOps.js        # File operations
│   │   └── errorHandler.js   # Error handling
│   └── index.js          # CLI entry point
├── docs/                 # Reference documentation
├── tests/                # Test files
└── package.json          # Project configuration
```

### Running Development Commands
```bash
# Run without global installation
node src/index.js --init
node src/index.js --check
node src/index.js --dir ./images

# Install dependencies
npm install

# Run tests (if available)
npm test
```

## Requirements

- **Node.js**: Version 14 or higher (ESM support required)
- **TinyPNG API Key**: Free tier provides 500 compressions/month
- **Supported Platforms**: Windows, macOS, Linux

## License

This project is provided as-is for educational and development purposes.

## Support

For issues, feature requests, or questions, please refer to the project documentation in the `docs/` directory or create an issue in the project repository.
