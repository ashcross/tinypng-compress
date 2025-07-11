import inquirer from 'inquirer';
import tinify from 'tinify';
import { configExists, loadConfig, saveConfig } from '../config/index.js';

async function addNewApiKey(config) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter API key name (e.g., client2):',
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
  
  const newApiKey = {
    name: answers.name,
    key: answers.key,
    email: answers.email,
    compressions_used: 0,
    last_reset: new Date().toISOString().split('T')[0],
    created: new Date().toISOString(),
    status: 'active'
  };
  
  try {
    tinify.key = answers.key;
    
    await new Promise((resolve, reject) => {
      tinify.validate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    newApiKey.compressions_used = tinify.compressionCount || 0;
    
    console.log(`✓ API key '${answers.name}' validated successfully`);
    console.log(`  Current usage: ${newApiKey.compressions_used}/500 compressions`);
    
  } catch (err) {
    throw new Error(`API key validation failed: ${err.message}`);
  }
  
  config.apiKeys.push(newApiKey);
  return newApiKey;
}

async function newKeyCommand() {
  try {
    // Check if configuration file exists
    if (!configExists()) {
      console.error('❌ Configuration file not found.');
      console.error('\nSuggestion: Run \'tinypng-compress --init\' first to create initial configuration');
      process.exit(1);
    }
    
    // Load existing configuration
    const config = await loadConfig();
    
    console.log('Adding new API key to existing configuration...\n');
    console.log(`Current API keys: ${config.apiKeys.length}`);
    
    if (config.apiKeys.length > 0) {
      const existingKeys = config.apiKeys.map(key => 
        `  - ${key.name} (${key.email})`
      ).join('\n');
      console.log(`Existing keys:\n${existingKeys}\n`);
    }
    
    // Add new API key
    const newApiKey = await addNewApiKey(config);
    
    // Save updated configuration
    await saveConfig(config);
    
    console.log(`\n✓ API key '${newApiKey.name}' added successfully`);
    console.log(`✓ Configuration updated with ${config.apiKeys.length} total API keys\n`);
    console.log(`Use 'tinypng-compress --check' to view all key status`);
    
  } catch (err) {
    console.error(`Error adding new API key: ${err.message}`);
    process.exit(1);
  }
}

export default newKeyCommand;