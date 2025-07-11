# Configuration Structure

## File Location
- **Path**: `./tinypng.config.json` (in current working directory)
- **Permissions**: 600 (owner read/write only)
- **Format**: JSON with validation schema

## Configuration Schema

### Complete Configuration Example
```json
{
  "version": "1.0.0",
  "apiKeys": [
    {
      "name": "client1",
      "key": "8R83ryFdFy61773sjwz42KPy40pakfwQ4",
      "email": "user1@moca.com",
      "compressions_used": 247,
      "last_reset": "2025-07-01",
      "created": "2025-07-01T10:30:00Z",
      "status": "active"
    },
    {
      "name": "client2", 
      "key": "LHD2XSGvql2DZwTgblN6v50HajRmTZRyb",
      "email": "user2@moca.com",
      "compressions_used": 500,
      "last_reset": "2025-07-01",
      "created": "2025-06-15T14:22:00Z", 
      "status": "limit_reached"
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

## Field Specifications

### API Key Object
```typescript
interface ApiKey {
  name: string;           // Unique identifier (required)
  key: string;            // TinyPNG API key (required)
  email: string;          // Associated email (required)
  compressions_used: number;  // Current month usage (0-500)
  last_reset: string;     // ISO date of last reset (YYYY-MM-DD)
  created: string;        // ISO datetime when key was added
  status: 'active' | 'limit_reached' | 'invalid' | 'disabled';
}
```

**Validation Rules**:
- `name`: 1-50 characters, alphanumeric + hyphens/underscores
- `key`: 32 character TinyPNG API key format
- `email`: Valid email format
- `compressions_used`: Integer 0-500
- `last_reset`: Valid date string (YYYY-MM-DD)

### Compression Settings
```typescript
interface CompressionSettings {
  preserve_metadata: boolean;     // Keep EXIF data
  convert_format: string | null;  // Target format or null
  quality: 'auto' | number;       // Compression quality
  resize: ResizeOptions | null;   // Resize settings
}

interface ResizeOptions {
  method: 'fit' | 'cover' | 'scale' | 'thumb';
  width?: number;
  height?: number;
}
```

### Output Settings
```typescript
interface OutputSettings {
  create_backup: boolean;         // Create backup directory
  backup_directory: string;       // Backup location
  output_directory: string;       // Compressed file location  
  preserve_structure: boolean;    // Keep subdirectory structure
  overwrite_existing: boolean;    // Overwrite existing compressed files
}
```

## Configuration Validation

### Schema Validation Function
```javascript
function validateConfig(config) {
  const errors = [];
  
  // Version check
  if (!config.version || config.version !== "1.0.0") {
    errors.push("Invalid or missing version");
  }
  
  // API Keys validation
  if (!config.apiKeys || !Array.isArray(config.apiKeys)) {
    errors.push("apiKeys must be an array");
  } else {
    config.apiKeys.forEach((key, index) => {
      validateApiKey(key, index, errors);
    });
  }
  
  // Settings validation
  validateCompressionSettings(config.compression, errors);
  validateOutputSettings(config.output, errors);
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}
```

### API Key Validation
```javascript
function validateApiKey(apiKey, index, errors) {
  const prefix = `apiKeys[${index}]`;
  
  // Name validation
  if (!apiKey.name || typeof apiKey.name !== 'string') {
    errors.push(`${prefix}.name is required`);
  } else if (!/^[a-zA-Z0-9_-]{1,50}$/.test(apiKey.name)) {
    errors.push(`${prefix}.name must be 1-50 alphanumeric characters`);
  }
  
  // Key format validation
  if (!apiKey.key || typeof apiKey.key !== 'string') {
    errors.push(`${prefix}.key is required`);
  } else if (!/^[a-zA-Z0-9]{32}$/.test(apiKey.key)) {
    errors.push(`${prefix}.key must be 32 character API key`);
  }
  
  // Email validation
  if (!apiKey.email || typeof apiKey.email !== 'string') {
    errors.push(`${prefix}.email is required`);
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(apiKey.email)) {
    errors.push(`${prefix}.email must be valid email address`);
  }
  
  // Usage validation
  if (typeof apiKey.compressions_used !== 'number' || 
      apiKey.compressions_used < 0 || 
      apiKey.compressions_used > 500) {
    errors.push(`${prefix}.compressions_used must be 0-500`);
  }
  
  // Date validation
  if (!apiKey.last_reset || !isValidDate(apiKey.last_reset)) {
    errors.push(`${prefix}.last_reset must be valid date (YYYY-MM-DD)`);
  }
}
```

## Default Configuration

### Minimal Configuration
```json
{
  "version": "1.0.0",
  "apiKeys": [],
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

## Configuration Management Functions

### Load Configuration
```javascript
function loadConfig() {
  const configPath = './tinypng.config.json';
  
  if (!fs.existsSync(configPath)) {
    throw new Error('Configuration file not found. Run --init to create one.');
  }
  
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    validateConfig(config);
    return config;
    
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error('Configuration file contains invalid JSON');
    }
    throw err;
  }
}
```

### Save Configuration
```javascript
function saveConfig(config) {
  validateConfig(config);
  
  const configPath = './tinypng.config.json';
  const configData = JSON.stringify(config, null, 2);
  
  try {
    fs.writeFileSync(configPath, configData, { mode: 0o600 });
    console.log('✓ Configuration saved successfully');
  } catch (err) {
    throw new Error(`Failed to save configuration: ${err.message}`);
  }
}
```

### Update API Key Usage
```javascript
function updateKeyUsage(config, keyName, newUsageCount) {
  const apiKey = config.apiKeys.find(key => key.name === keyName);
  
  if (!apiKey) {
    throw new Error(`API key '${keyName}' not found in configuration`);
  }
  
  // Check if monthly reset is needed
  if (isNewMonth(apiKey.last_reset)) {
    apiKey.compressions_used = 0;
    apiKey.last_reset = new Date().toISOString().split('T')[0];
    apiKey.status = 'active';
  }
  
  // Update usage count
  apiKey.compressions_used = newUsageCount;
  
  // Update status based on usage
  if (newUsageCount >= 500) {
    apiKey.status = 'limit_reached';
  } else {
    apiKey.status = 'active';
  }
  
  // Save updated configuration
  saveConfig(config);
  
  return apiKey;
}
```

### Monthly Reset Logic
```javascript
function isNewMonth(lastReset) {
  const now = new Date();
  const reset = new Date(lastReset);
  
  return now.getMonth() !== reset.getMonth() || 
         now.getFullYear() !== reset.getFullYear();
}

function resetAllKeysIfNeeded(config) {
  let updated = false;
  
  config.apiKeys.forEach(apiKey => {
    if (isNewMonth(apiKey.last_reset)) {
      apiKey.compressions_used = 0;
      apiKey.last_reset = new Date().toISOString().split('T')[0];
      apiKey.status = 'active';
      updated = true;
    }
  });
  
  if (updated) {
    saveConfig(config);
    console.log('✓ Monthly usage reset applied to API keys');
  }
  
  return updated;
}
```

## Interactive Configuration Setup

### Add New API Key
```javascript
import inquirer from 'inquirer';

async function addApiKey(config) {
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter API key name (e.g., client1):',
      validate: (input) => {
        if (!/^[a-zA-Z0-9_-]{1,50}$/.test(input)) {
          return 'Name must be 1-50 alphanumeric characters, hyphens, or underscores';
        }
        if (config.apiKeys.find(key => key.name === input)) {
          return 'Name already exists, choose a different name';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'key',
      message: 'Enter TinyPNG API key:',
      validate: (input) => {
        if (!/^[a-zA-Z0-9]{32}$/.test(input)) {
          return 'API key must be exactly 32 characters';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter associated email:',
      validate: (input) => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
          return 'Please enter a valid email address';
        }
        return true;
      }
    }
  ]);
  
  // Create new API key object
  const newApiKey = {
    name: answers.name,
    key: answers.key,
    email: answers.email,
    compressions_used: 0,
    last_reset: new Date().toISOString().split('T')[0],
    created: new Date().toISOString(),
    status: 'active'
  };
  
  // Validate API key with TinyPNG
  try {
    import tinify from 'tinify';
    tinify.key = answers.key;
    await new Promise((resolve, reject) => {
      tinify.validate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Get current usage count
    newApiKey.compressions_used = tinify.compressionCount || 0;
    
    console.log(`✓ API key '${answers.name}' validated successfully`);
    console.log(`  Current usage: ${newApiKey.compressions_used}/500 compressions`);
    
  } catch (err) {
    throw new Error(`API key validation failed: ${err.message}`);
  }
  
  // Add to configuration
  config.apiKeys.push(newApiKey);
  return newApiKey;
}
```

### Configuration Migration
```javascript
function migrateConfig(config) {
  let migrated = false;
  
  // Add version if missing
  if (!config.version) {
    config.version = "1.0.0";
    migrated = true;
  }
  
  // Add missing fields to API keys
  config.apiKeys.forEach(apiKey => {
    if (!apiKey.created) {
      apiKey.created = new Date().toISOString();
      migrated = true;
    }
    
    if (!apiKey.status) {
      apiKey.status = apiKey.compressions_used >= 500 ? 'limit_reached' : 'active';
      migrated = true;
    }
  });
  
  // Add advanced settings if missing
  if (!config.advanced) {
    config.advanced = {
      max_concurrent: 3,
      retry_attempts: 3,
      request_delay: 100
    };
    migrated = true;
  }
  
  if (migrated) {
    saveConfig(config);
    console.log('✓ Configuration updated to latest version');
  }
  
  return config;
}
```

## Security Considerations

### File Permissions
```javascript
function setSecurePermissions(configPath) {
  try {
    fs.chmodSync(configPath, 0o600); // Owner read/write only
  } catch (err) {
    console.warn('Warning: Could not set secure file permissions');
  }
}
```

### API Key Sanitization
```javascript
function sanitizeConfigForLogging(config) {
  const sanitized = JSON.parse(JSON.stringify(config));
  
  sanitized.apiKeys.forEach(apiKey => {
    // Replace API key with masked version
    apiKey.key = apiKey.key.slice(0, 4) + '***' + apiKey.key.slice(-4);
  });
  
  return sanitized;
}
```

## Environment Variable Support

### Override Configuration
```javascript
function applyEnvironmentOverrides(config) {
  // Allow environment variables to override settings
  if (process.env.TINYPNG_MAX_CONCURRENT) {
    config.advanced.max_concurrent = parseInt(process.env.TINYPNG_MAX_CONCURRENT);
  }
  
  if (process.env.TINYPNG_BACKUP_DIR) {
    config.output.backup_directory = process.env.TINYPNG_BACKUP_DIR;
  }
  
  // Allow adding API key via environment (for CI/CD)
  if (process.env.TINYPNG_API_KEY && process.env.TINYPNG_KEY_NAME) {
    const envKey = {
      name: process.env.TINYPNG_KEY_NAME,
      key: process.env.TINYPNG_API_KEY,
      email: process.env.TINYPNG_EMAIL || 'env@example.com',
      compressions_used: 0,
      last_reset: new Date().toISOString().split('T')[0],
      created: new Date().toISOString(),
      status: 'active'
    };
    
    // Only add if not already exists
    if (!config.apiKeys.find(key => key.name === envKey.name)) {
      config.apiKeys.push(envKey);
    }
  }
  
  return config;
}
```