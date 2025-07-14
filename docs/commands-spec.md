# CLI Commands Specification

## Phase 1 (MVP) Commands

### Initialize Configuration
```bash
tinypng-compress --init
```

**Purpose**: Create initial configuration file with interactive setup

**Flow**:
1. Check if `tinypng.config.json` exists
2. If exists, ask to overwrite or edit
3. Interactive prompts:
   - "Enter API key name (e.g., 'client1'): "
   - "Enter API key: "
   - "Enter associated email: "
   - "Add another API key? (y/N): "
4. Validate all entered API keys
5. Save configuration with default settings

**Output**:
```
✓ Configuration saved to tinypng.config.json
✓ Added 3 API keys
✓ All keys validated successfully

Use 'tinypng-compress --check' to view key status
```

### Check API Key Status
```bash
tinypng-compress --check
```

**Purpose**: Display current usage for all configured API keys

**Flow**:
1. Load configuration file
2. For each API key:
   - Validate key and get compression count
   - Check if monthly reset needed
   - Update local usage tracking
3. Display formatted table
4. Save updated usage counts

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

Total available compressions: 664
```

**Error Handling**:
- No config file: "Run 'tinypng-compress --init' to set up configuration"
- Invalid API key: Mark as "Invalid" in status column
- Network error: Mark as "Error" with retry suggestion

### Compress Single File
```bash
tinypng-compress --file <filepath> --api-key <keyname>
```

**Required Arguments**:
- `--file`: Path to image file
- `--api-key`: Name of API key from configuration

**Optional Arguments**:
- `--preserve-metadata`: Keep EXIF data
- `--convert <format>`: Convert to specified format (webp, png, jpeg, avif)

**Flow**:
1. Validate file exists and is supported format
2. Load configuration and find specified API key
3. Check API key has available compressions
4. Create `./original/` directory if not exists
5. Copy original file to `./original/`
6. Compress using TinyPNG API
7. Save compressed file to original location
8. Update usage count in configuration
9. Display compression statistics

**Examples**:
```bash
# Basic compression
tinypng-compress --file ./logo.png --api-key client1

# With metadata preservation
tinypng-compress --file ./photo.jpg --api-key client1 --preserve-metadata

# With format conversion
tinypng-compress --file ./image.png --api-key client1 --convert webp
```

**Output Example**:
```
Compressing: ./logo.png
✓ Original backed up to: ./original/logo.png
✓ Compressed successfully using API key 'client1'

File Statistics:
  Original:   2.4 MB
  Compressed: 1.8 MB  
  Savings:    25% (600 KB saved)

API Key Usage:
  client1: 248/500 compressions used (252 remaining)
```

### Compress Directory
```bash
tinypng-compress --dir <directory> --api-key <keyname>
```

**Required Arguments**:
- `--dir`: Path to directory containing images
- `--api-key`: Name of API key from configuration

**Optional Arguments**:
- `--recursive`: Include subdirectories (Phase 2)
- `--preserve-metadata`: Keep EXIF data for all files
- `--convert <format>`: Convert all files to specified format

**Flow**:
1. Scan directory for supported image files
2. Load configuration and find specified API key
3. Check API key has sufficient compressions available
4. Display file count and compression estimate
5. Create `./original/` subdirectory
6. Move all original images to `./original/`
7. Process each image:
   - Compress using specified API key
   - Save to original location  
   - Update progress
   - Stop if API key reaches limit
8. Display comprehensive report

**Example**:
```bash
tinypng-compress --dir ./images/ --api-key client1
```

**Output Example**:
```
Scanning directory: ./images/
Found 47 supported image files

Checking API key 'client1'...
✓ 253 compressions available (sufficient for 47 files)

Creating backup directory: ./images/original/
Moving originals to backup...
✓ 47 files backed up

Compressing images:
[████████████████████████████████████████] 47/47 files (100%)

Compression Report:
┌─────────────────────┬─────────────┬─────────────┬──────────┐
│ File Type           │ Count       │ Size Before │ Size After│
├─────────────────────┼─────────────┼─────────────┼──────────┤
│ PNG                 │ 23          │ 45.2 MB     │ 32.1 MB  │
│ JPEG                │ 19          │ 23.8 MB     │ 19.2 MB  │  
│ WebP                │ 5           │ 8.1 MB      │ 6.8 MB   │
└─────────────────────┴─────────────┴─────────────┴──────────┘

Total: 77.1 MB → 58.1 MB (25% reduction, 19.0 MB saved)
API Key Usage: client1 now at 300/500 compressions
```

## Phase 2 (Enhanced) Commands

### Multi-Key Directory Compression
```bash
tinypng-compress --dir <directory> --strategy multi-key
```

**Purpose**: Automatically use multiple API keys for large batch processing

**Optional Arguments**:
- `--max-concurrent <number>`: Maximum simultaneous compressions (default: 3)
- `--strategy <type>`: Key selection strategy (multi-key, round-robin, least-used)

**Enhanced Output**:
```
Multi-Key Compression Report
┌─────────────────────┬─────────────┬──────────┬───────────┬──────────┐
│ API Key             │ Used Before │ Used Now │ Files     │ Status   │
├─────────────────────┼─────────────┼──────────┼───────────┼──────────┤
│ client1             │ 247         │ 374      │ 127       │ Active   │
│ client2             │ 89          │ 245      │ 156       │ Active   │
│ client3             │ 23          │ 106      │ 83        │ Active   │
└─────────────────────┴─────────────┴──────────┴───────────┴──────────┘

Total: 366 images compressed using 3 API keys
Estimated cost savings vs single key: Completed 100% vs 51% with one key
```

## Command Validation Rules

### File Path Validation
```javascript
// Supported extensions
const SUPPORTED_FORMATS = ['.png', '.jpg', '.jpeg', '.webp', '.avif'];

// File existence and format check
function validateFile(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
  
  const ext = path.extname(filepath).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
  }
}
```

### API Key Validation
```javascript
function validateApiKey(keyName, config) {
  const apiKey = config.apiKeys.find(key => key.name === keyName);
  
  if (!apiKey) {
    const availableKeys = config.apiKeys.map(k => k.name).join(', ');
    throw new Error(`API key '${keyName}' not found. Available keys: ${availableKeys}`);
  }
  
  if (apiKey.compressions_used >= 500) {
    throw new Error(`API key '${keyName}' has reached monthly limit (500/500 compressions used)`);
  }
  
  return apiKey;
}
```

## Error Messages

### Standard Error Format
```
Error: [Category] Description

Suggestion: Actionable next step

Example:
Error: API key 'client1' has reached monthly limit (500/500 compressions used)

Suggestion: Use a different API key or wait until next month (resets August 1st)
Available keys with capacity: client2 (89/500), client3 (23/500)
```

### Common Error Categories
- **Configuration**: Missing config file, invalid API keys
- **File System**: File not found, permission denied, disk space
- **API Limit**: Compression limit reached, invalid API key
- **Network**: Connection failed, API server error
- **Validation**: Unsupported format, invalid arguments

## Help Documentation

### Main Help
```bash
tinypng-compress --help
```

**Output**:
```
TinyPNG Local Compression Tool

Usage: tinypng-compress [options]

Options:
  --init                     Create configuration file
  --check                    Show API key usage status
  --file <path>             Compress single file
  --dir <path>              Compress directory
  --api-key <name>          Specify API key to use
  --preserve-metadata       Keep EXIF data
  --convert <format>        Convert to format (webp|png|jpeg|avif)
  --recursive               Include subdirectories
  -h, --help               Display help information

Examples:
  tinypng-compress --init
  tinypng-compress --check  
  tinypng-compress --file logo.png --api-key client1
  tinypng-compress --dir ./images/ --api-key client1

Get started:
  1. Run 'tinypng-compress --init' to set up API keys
  2. Use 'tinypng-compress --check' to verify setup
  3. Compress files with '--file' or '--dir' commands
```