# Claude Code Project Structure - TinyPNG Compression Tool

## Primary claude.md File

```markdown
# TinyPNG Local Compression Tool

You are building a Node.js CLI tool that compresses images using the TinyPNG API with intelligent API key management.

## Project Overview
- **Goal**: Create a robust CLI tool for batch image compression with API key rotation
- **Tech Stack**: Node.js, Commander.js, TinyPNG API, fs-extra
- **Phases**: MVP (single key selection) → Enhanced (multi-key automation)

## Current Focus
**Ignore all other reference files for now. Focus only on this file and the references / tasks within it:**
- /docs/00_current-focus.md

## Key Requirements
1. Manual API key selection via `--api-key <name>` flag
2. Usage tracking and display via `--check` command  
3. Automatic backup of originals to `./original/` directory
4. Support for single files and entire directories
5. Clear error handling for API limits and invalid keys

## Reference Files
- `docs/api-reference.md` - TinyPNG API details and Node.js client usage
- `docs/commands-spec.md` - Detailed command specifications and examples
- `docs/config-structure.md` - Configuration file format and validation
- `docs/error-handling.md` - Comprehensive error scenarios and responses
- `docs/file-operations.md` - File backup, directory scanning, and organization logic

## Project Structure
```
tinypng-compress/
├── src/
│   ├── commands/          # Command handlers
│   ├── config/           # Configuration management
│   ├── compression/      # TinyPNG API logic
│   └── utils/           # File operations, validation
├── docs/                # Reference documentation
├── tests/               # Test files
└── package.json
```

## Implementation Notes
- Start with basic CLI setup using Commander.js
- Implement configuration management first (critical foundation)
- Add compression logic incrementally
- Focus on error handling early (API limits are common)

## Next Steps
1. Set up basic CLI structure with Commander.js
2. Implement configuration file creation and validation
3. Add `--check` command for API key status
4. Build single file compression with manual key selection
```

## Reference Files Structure

### 1. docs/api-reference.md
**Focus**: TinyPNG API technical details
- Official tinify npm package usage
- Authentication and key validation
- Compression count tracking (`tinify.compressionCount`)
- Error types and handling
- Rate limiting considerations
- File format support (AVIF, WebP, JPEG, PNG)

### 2. docs/commands-spec.md  
**Focus**: CLI command specifications
- Complete command syntax for Phase 1
- Flag definitions and validation
- Input/output examples
- Command flow and logic
- Future Phase 2 commands (for reference)

### 3. docs/config-structure.md
**Focus**: Configuration management
- JSON configuration schema
- API key object structure with name, email, usage tracking
- Validation rules and required fields
- Default settings and user preferences
- Config file location and permissions

### 4. docs/error-handling.md
**Focus**: Error scenarios and responses
- API limit exceeded (per key)
- Invalid API key names
- File system errors (permissions, disk space)
- Network and TinyPNG API errors
- Graceful degradation strategies
- User-friendly error messages

### 5. docs/file-operations.md
**Focus**: File and directory management
- Directory scanning for supported formats
- Backup strategy (`./original/` creation)
- Atomic file operations
- File validation and safety checks
- Progress tracking for batch operations
- File size reporting and statistics

## Why This Structure Works for Claude Code

### Focused Context
Each reference file addresses a specific domain, preventing Claude from getting overwhelmed by the full PRD while coding.

### Incremental Development
The primary claude.md keeps Claude focused on current phase while reference files provide detailed specs when needed.

### Clear Separation of Concerns
- **claude.md**: Current objectives and high-level guidance
- **api-reference.md**: Technical API integration details
- **commands-spec.md**: User interface and CLI behavior
- **config-structure.md**: Data persistence and validation
- **error-handling.md**: Robustness and user experience
- **file-operations.md**: Core business logic

### Practical Benefits
1. **Reduced Token Usage**: Claude only loads relevant context per task
2. **Better Code Quality**: Focused specifications lead to more precise implementations
3. **Easier Debugging**: Clear separation makes it easier to identify which reference file to consult
4. **Maintainable**: Updates to requirements only affect specific reference files
5. **Scalable**: Easy to add new reference files as project grows

## Implementation Strategy

### Session 1: Project Foundation
**Primary**: claude.md + config-structure.md + commands-spec.md
- Set up basic CLI with Commander.js
- Implement configuration file management
- Add `--init` and `--check` commands

### Session 2: Core Compression
**Primary**: claude.md + api-reference.md + file-operations.md  
- Integrate TinyPNG API
- Implement single file compression
- Add backup system

### Session 3: Directory Processing
**Primary**: claude.md + file-operations.md + error-handling.md
- Directory scanning and batch processing
- Error handling and recovery
- Progress reporting

### Session 4: Polish & Testing
**Primary**: claude.md + error-handling.md + commands-spec.md
- Comprehensive error handling
- User experience improvements
- Testing and validation

This structure ensures Claude Code stays focused on immediate tasks while having access to comprehensive specifications when needed. Each session can load only the relevant reference files, keeping context manageable and code quality high.