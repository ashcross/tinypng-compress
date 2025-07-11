# TinyPNG Local Compression Script - Product Requirements Document

## 1. Executive Summary

This document outlines the requirements for a Node.js command-line tool that leverages the TinyPNG API to compress images locally. The tool will manage API key rotation, track compression usage, and provide flexible file/directory processing with organized output structure.

## 2. Core Requirements

### 2.1 API Management
- **API Key Configuration**: Support for multiple API keys via configuration file
- **Usage Tracking**: Real-time monitoring of compressions remaining per API key (500 free per month per key)
- **Key Rotation**: Automatic switching to available keys when limits are reached
- **Validation**: Pre-compression API key validation to prevent failed requests

### 2.2 Compression Functionality
- **File Input**: Support for single file compression
- **Directory Input**: Batch compression of entire directories
- **Supported Formats**: AVIF, WebP, JPEG, PNG (as per TinyPNG API capabilities)
- **Recursive Processing**: Optional subdirectory traversal
- **File Organization**: Automatic backup of originals and organized output

### 2.3 Configuration Management
- **API Keys**: Centralized configuration for multiple API keys
- **Compression Settings**: Configurable quality, format conversion, and metadata preservation
- **Output Preferences**: Customizable directory structure and naming conventions

## 3. Technical Specifications

### 3.1 Dependencies
```json
{
  "tinify": "^1.8.1",
  "commander": "^11.0.0",
  "fs-extra": "^11.0.0",
  "path": "^0.12.7",
  "chalk": "^5.0.0",
  "inquirer": "^9.0.0"
}
```

### 3.2 Configuration File Structure
```json
{
  "apiKeys": [
    {
      "key": "YOUR_API_KEY_1",
      "email": "user1@moca.com",
      "compressions_used": 0,
      "last_reset": "2025-07-01",
      "name": "client1"
    },
    {
      "key": "YOUR_API_KEY_2", 
      "email": "user2@moca.com",
      "compressions_used": 0,
      "last_reset": "2025-07-01",
      "name": "client2"
    }
  ],
  "compression": {
    "preserve_metadata": false,
    "convert_format": null,
    "quality": "auto",
    "resize": null
  },
  "output": {
    "create_backup": true,
    "backup_directory": "./original",
    "output_directory": "./",
    "preserve_structure": true
  }
}
```

### 3.3 Command Structure
```bash
# Check remaining compressions for all API keys
tinypng-compress --check

# Compress using specific API key (Phase 1 - MVP)
tinypng-compress --file /path/to/image.png --api-key client1
tinypng-compress --dir /path/to/images/ --api-key client1

# Compress using all available API keys (Phase 2 - Enhanced)
tinypng-compress --dir /path/to/images/ --strategy multi-key

# Compress with specific settings
tinypng-compress --dir /path/to/images/ --api-key client1 --preserve-metadata --convert webp

# Initialize configuration
tinypng-compress --init
```

## 4. Detailed Feature Requirements

### 4.1 Usage Tracking Command
**Command**: `tinypng-compress --check`

**Functionality**:
- Query TinyPNG API for each configured key using `tinify.compressionCount`
- Display table showing:
  - Email associated with key
  - Compressions used this month
  - Compressions remaining (500 - used)
  - Key status (Active/Limit Reached)
- Update local config with current usage data
- **No authentication errors**: Validate all keys and mark invalid ones

**Output Example**:
```
API Key Usage Report - July 2025
┌─────────────────────┬─────────────┬──────────┬───────────┬──────────┐
│ Name                │ Email       │ Used     │ Remaining │ Status   │
├─────────────────────┼─────────────┼──────────┼───────────┼──────────┤
│ client1             │ user1@moca  │ 247      │ 253       │ Active   │
│ client2             │ user2@moca  │ 500      │ 0         │ Limit    │
│ client3             │ user3@moca  │ 89       │ 411       │ Active   │
└─────────────────────┴─────────────┴──────────┴───────────┴──────────┘
```

### 4.2 File Compression (Phase 1 - MVP)
**Command**: `tinypng-compress --file <filepath> --api-key <keyname>`

**Process**:
1. Validate file exists and is supported format
2. Lookup specified API key by name in config
3. Verify key has available compressions (< 500 used)
4. Create backup in `./original/` directory
5. Compress using specified TinyPNG API key
6. Save compressed version to original location
7. Update usage tracking for that specific key
8. Display compression statistics (original size, compressed size, savings %)

**Error Handling**:
- Invalid file format
- File not found
- Specified API key not found in config
- Selected API key at limit (500 compressions used)
- Network/API errors

**Example**:
```bash
tinypng-compress --file ./logo.png --api-key client1
```

### 4.3 Directory Compression (Phase 1 - MVP)
**Command**: `tinypng-compress --dir <directory> --api-key <keyname>`

**Process**:
1. Scan directory for supported image files
2. Lookup specified API key by name in config
3. Verify key has sufficient compressions available
4. Create `./original/` subdirectory
5. Move all original images to `./original/`
6. Process each image:
   - Use specified API key for compression
   - Compress via TinyPNG API
   - Save compressed version to main directory
   - Update usage counter for that key
   - Stop if key reaches limit during processing
7. Generate compression report

**Error Handling**:
- API key reaches limit mid-process (display progress and remaining files)
- Insufficient compressions available before starting
- Invalid API key name

**Example**:
```bash
tinypng-compress --dir ./images/ --api-key client1
```

### 4.4 Multi-Key Directory Compression (Phase 2 - Enhanced)
**Command**: `tinypng-compress --dir <directory> --strategy multi-key`

**Process**:
1. Scan directory for supported image files
2. Get all API keys with available compressions (< 500 used)
3. Create `./original/` subdirectory
4. Move all original images to `./original/`
5. Process each image:
   - Select API key with most available compressions
   - Compress via TinyPNG API
   - Save compressed version to main directory
   - Update usage counter for used key
   - Automatically switch keys when one reaches limit
6. Generate comprehensive report showing usage across all keys

**Intelligent Key Selection**:
- Prioritize keys with most remaining compressions
- Distribute load evenly across available keys
- Skip keys that reach 500 compression limit
- Fail gracefully if all keys reach limit

**Example**:
```bash
tinypng-compress --dir ./images/ --strategy multi-key
```

**Enhanced Reporting**:
```
Multi-Key Compression Report
┌─────────────────────┬─────────────┬──────────┬───────────┐
│ API Key             │ Used Before │ Used     │ Files     │
├─────────────────────┼─────────────┼──────────┼───────────┤
│ client1             │ 247         │ 127      │ 127       │
│ client2             │ 89          │ 156      │ 156       │
│ client3             │ 23          │ 83       │ 83        │
└─────────────────────┴─────────────┴──────────┴───────────┘
Total: 366 images compressed using 3 API keys
```

### 4.5 Configuration Management
**Command**: `tinypng-compress --init`

**Process**:
1. Create `tinypng.config.json` if not exists
2. Interactive setup:
   - Add API keys with unique names for identification
   - Associate email addresses for tracking
   - Set compression preferences
   - Configure output settings
3. Validate all API keys
4. Save configuration

**Configuration Options**:
- **name**: Unique identifier for each API key (e.g., "client1", "moca-main")
- **preserve_metadata**: Keep EXIF data (copyright, creation date, GPS)
- **convert_format**: Target format (webp, png, jpeg, avif)
- **resize**: Dimensions for automatic resizing
- **backup_directory**: Where to store originals
- **output_directory**: Where to save compressed files

## 5. Error Handling & Edge Cases

### 5.1 API Limit Management

**Phase 1 Scenarios**:
- **Scenario**: Specified API key has reached monthly limit
- **Response**: Display error showing remaining compressions (0), suggest using different key
- **Command**: Show available keys with `--check` command

**Phase 2 Scenarios**:
- **Scenario**: All API keys reach monthly limit during multi-key processing
- **Response**: Complete processing of remaining files with available keys, then display comprehensive report
- **Fallback**: Graceful degradation showing which files couldn't be processed

### 5.2 Network Issues
- **Connection Errors**: Retry with exponential backoff (3 attempts)
- **Rate Limiting**: Implement delays between requests
- **Invalid API Keys**: Mark as inactive and skip

### 5.3 File System Issues
- **Permission Errors**: Clear error messages with suggested solutions
- **Disk Space**: Check available space before processing
- **File Conflicts**: Backup existing files before overwriting

## 6. Performance Considerations

### 6.1 Batch Processing
- **Concurrent Limits**: Maximum 3 simultaneous compressions to respect API rate limits
- **Progress Indication**: Real-time progress bar for directory processing
- **Resume Capability**: Skip already processed files (based on backup existence)

### 6.2 Memory Management
- **Large Files**: Stream processing for files > 100MB
- **Directory Size**: Process in chunks for large directories (>1000 files)

## 7. Security & Best Practices

### 7.1 API Key Security
- **Storage**: Store in user-specific config directory (`~/.config/tinypng/`)
- **Permissions**: Restrict config file to owner read/write only
- **Validation**: Never log API keys in console output

### 7.2 Data Integrity
- **Backup Verification**: Ensure originals are safely backed up before compression
- **Atomic Operations**: Complete file operations atomically to prevent corruption
- **Error Recovery**: Restore from backup on compression failure

## 8. User Experience

### 8.1 CLI Interface
- **Clear Commands**: Intuitive command structure with helpful descriptions
- **Progress Feedback**: Real-time progress indicators for long operations
- **Helpful Errors**: Actionable error messages with suggested fixes

### 8.2 Reporting
- **Compression Stats**: Show file size savings and compression ratios
- **API Usage**: Display monthly usage across all keys
- **Summary Reports**: End-of-operation statistics

## 9. Future Enhancements

### 9.1 Planned Features
- **Recursive directory processing** with `--recursive` flag
- **Custom quality settings** per image type
- **Integration with cloud storage** (S3, Google Cloud)
- **Batch resize operations** with smart cropping
- **Config profiles** for different use cases

### 9.2 Advanced Options
- **Format conversion** during compression
- **Metadata preservation** options
- **Custom output naming** patterns
- **Integration with CI/CD** pipelines

## 10. Implementation Priority

### Phase 1 (MVP) - Single API Key Selection
**Target**: Simple, reliable compression with manual key selection
1. **Core compression functionality**:
   - Single file compression with `--api-key` flag
   - Directory compression with `--api-key` flag
   - Named API key lookup and validation
2. **Configuration system**:
   - API key management with unique names
   - Basic compression settings
   - File backup system with `./original/` directory
3. **Usage tracking**:
   - `--check` command showing all key statuses
   - Per-key compression count tracking
   - Clear error messages for key limits
4. **Essential error handling**:
   - Invalid API key names
   - File not found errors
   - API limit exceeded for selected key

**Commands for Phase 1**:
```bash
tinypng-compress --file image.png --api-key client1
tinypng-compress --dir ./images/ --api-key client1
tinypng-compress --check
tinypng-compress --init
```

### Phase 2 (Enhanced) - Multi-Key Automation
**Target**: Intelligent key rotation and maximum throughput
1. **Multi-key processing**:
   - `--strategy multi-key` flag for automatic key rotation
   - Intelligent key selection (most available compressions)
   - Load distribution across multiple API keys
2. **Advanced reporting**:
   - Per-key usage breakdown in compression reports
   - Progress indicators for large batches
   - Detailed statistics and efficiency metrics
3. **Enhanced error handling**:
   - Graceful key switching when limits reached
   - Resume capability for interrupted processes
   - Comprehensive failure reporting
4. **Performance optimizations**:
   - Concurrent processing (respecting API rate limits)
   - Batch processing for large directories
   - Memory-efficient handling of large files

**Additional Commands for Phase 2**:
```bash
tinypng-compress --dir ./images/ --strategy multi-key
tinypng-compress --dir ./images/ --strategy multi-key --max-concurrent 3
```

### Phase 3 (Advanced) - Future Enhancements
1. **Format conversion and resizing**
2. **Cloud storage integration**
3. **CI/CD pipeline integration**
4. **Advanced configuration profiles**

---

## Success Metrics
- **Successful compression rate**: >95% for valid files
- **API usage efficiency**: Optimal key rotation with minimal waste
- **User experience**: Clear feedback and error handling
- **Data safety**: Zero data loss incidents with reliable backup system