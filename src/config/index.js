import fs from 'fs-extra';
import path from 'path';

const CONFIG_FILE = './tinypng.config.json';

const DEFAULT_CONFIG = {
  version: "1.0.0",
  apiKeys: [],
  compression: {
    preserve_metadata: false,
    convert_format: "auto",
    quality: "auto",
    resize: null
  },
  defaults: {
    api_key_selection: "auto",
    convert_format: "auto"
  },
  output: {
    create_backup: true,
    backup_directory: "./original",
    output_directory: "./",
    preserve_structure: true,
    overwrite_existing: false
  },
  advanced: {
    max_concurrent: 3,
    retry_attempts: 3,
    request_delay: 100
  }
};

function validateApiKey(apiKey, index, errors) {
  const prefix = `apiKeys[${index}]`;
  
  if (!apiKey.name || typeof apiKey.name !== 'string') {
    errors.push(`${prefix}.name is required`);
  } else if (!/^[a-zA-Z0-9_-]{1,50}$/.test(apiKey.name)) {
    errors.push(`${prefix}.name must be 1-50 alphanumeric characters`);
  }
  
  if (!apiKey.key || typeof apiKey.key !== 'string') {
    errors.push(`${prefix}.key is required`);
  } else if (!/^[a-zA-Z0-9]{32}$/.test(apiKey.key)) {
    errors.push(`${prefix}.key must be 32 character API key`);
  }
  
  if (!apiKey.email || typeof apiKey.email !== 'string') {
    errors.push(`${prefix}.email is required`);
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(apiKey.email)) {
    errors.push(`${prefix}.email must be valid email address`);
  }
  
  if (typeof apiKey.compressions_used !== 'number' || 
      apiKey.compressions_used < 0 || 
      apiKey.compressions_used > 500) {
    errors.push(`${prefix}.compressions_used must be 0-500`);
  }
  
  if (!apiKey.last_reset || !isValidDate(apiKey.last_reset)) {
    errors.push(`${prefix}.last_reset must be valid date (YYYY-MM-DD)`);
  }
}

function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date.toISOString().split('T')[0] === dateString;
}

function validateConfig(config) {
  const errors = [];
  
  if (!config.version || config.version !== "1.0.0") {
    errors.push("Invalid or missing version");
  }
  
  if (!config.apiKeys || !Array.isArray(config.apiKeys)) {
    errors.push("apiKeys must be an array");
  } else {
    config.apiKeys.forEach((key, index) => {
      validateApiKey(key, index, errors);
    });
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

async function loadConfig() {
  if (!await fs.pathExists(CONFIG_FILE)) {
    throw new Error('Configuration file not found. Run --init to create one.');
  }
  
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf8');
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

async function saveConfig(config) {
  validateConfig(config);
  
  const configData = JSON.stringify(config, null, 2);
  
  try {
    await fs.writeFile(CONFIG_FILE, configData, { mode: 0o600 });
    console.log('✓ Configuration saved successfully');
  } catch (err) {
    throw new Error(`Failed to save configuration: ${err.message}`);
  }
}

function configExists() {
  return fs.existsSync(CONFIG_FILE);
}

function createDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function isNewMonth(lastReset) {
  const now = new Date();
  const reset = new Date(lastReset);
  
  return now.getMonth() !== reset.getMonth() || 
         now.getFullYear() !== reset.getFullYear();
}

async function resetAllKeysIfNeeded(config) {
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
    await saveConfig(config);
    console.log('✓ Monthly usage reset applied to API keys');
  }
  
  return updated;
}

async function updateKeyUsage(config, keyName, newUsageCount) {
  const apiKey = config.apiKeys.find(key => key.name === keyName);
  
  if (!apiKey) {
    throw new Error(`API key '${keyName}' not found in configuration`);
  }
  
  if (isNewMonth(apiKey.last_reset)) {
    apiKey.compressions_used = 0;
    apiKey.last_reset = new Date().toISOString().split('T')[0];
    apiKey.status = 'active';
  }
  
  apiKey.compressions_used = newUsageCount;
  
  if (newUsageCount >= 500) {
    apiKey.status = 'limit_reached';
  } else {
    apiKey.status = 'active';
  }
  
  await saveConfig(config);
  
  return apiKey;
}

export {
  loadConfig,
  saveConfig,
  configExists,
  createDefaultConfig,
  validateConfig,
  resetAllKeysIfNeeded,
  updateKeyUsage,
  isNewMonth,
  CONFIG_FILE
};