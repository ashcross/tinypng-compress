Excellent! Both error cases are now working correctly:

  1. ✅ Non-existent API key: Shows "API key 'nonexistent' not found.
  Available keys: Moca1"
  2. ✅ Missing config file: Shows "Configuration file not found"

  Summary

  I have successfully implemented Phase 3 of the TinyPNG compression
  tool with the following features:

  ✅ Directory Processing (--dir command)

  - Scans directories for supported image files (.png, .jpg, .jpeg,
  .webp, .avif)
  - Supports recursive directory scanning with --recursive flag
  - Validates all files before processing
  - Handles both single-level and nested directory structures

  ✅ Backup System

  - Creates ./original/ directory automatically
  - Backs up all files before compression
  - Handles duplicate backups with versioned timestamps
  - Preserves file timestamps and metadata in backups
  - Smart backup detection (skips identical files)

  ✅ Progress Tracking

  - Real-time progress bar during batch processing
  - Shows current file being processed
  - Displays running total of savings
  - Provides throughput metrics (files/second)

  ✅ Comprehensive Reporting

  - Detailed compression statistics
  - File type breakdown
  - Performance metrics
  - API key usage tracking
  - Failed files listing with error details

  ✅ Enhanced Error Handling

  - Fixed misleading error messages
  - Specific error handling for non-existent API keys
  - Proper configuration file error detection
  - User-friendly error suggestions

  ✅ Additional Features

  - Format conversion support (--convert png/jpg/webp/avif)
  - Metadata preservation (--preserve-metadata)
  - Intelligent file size reporting (handles cases where files
  increase in size)
  - Robust validation and safety checks

  The implementation follows the specifications from the reference
  documents and provides a professional, user-friendly experience with
   proper error handling and comprehensive reporting.