import inquirer from 'inquirer';
import tinify from 'tinify';
import { configExists, createDefaultConfig, saveConfig } from '../config/index.js';

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

async function initCommand() {
  try {
    if (configExists()) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Configuration file already exists. Overwrite?',
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log('Configuration initialization cancelled.');
        return;
      }
    }
    
    const config = createDefaultConfig();
    let keyCount = 0;
    
    console.log('Setting up TinyPNG configuration...\n');
    
    while (true) {
      try {
        await addApiKey(config);
        keyCount++;
        
        const { addAnother } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addAnother',
            message: 'Add another API key?',
            default: false
          }
        ]);
        
        if (!addAnother) break;
        
      } catch (err) {
        console.error(`Error adding API key: ${err.message}`);
        
        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Try again?',
            default: true
          }
        ]);
        
        if (!retry) break;
      }
    }
    
    if (keyCount === 0) {
      console.log('No API keys added. Configuration not saved.');
      return;
    }
    
    saveConfig(config);
    console.log(`\n✓ Configuration saved successfully`);
    console.log(`✓ Added ${keyCount} API key${keyCount === 1 ? '' : 's'}`);
    console.log(`✓ All keys validated successfully\n`);
    console.log(`Use 'tinypng-compress --check' to view key status`);
    
  } catch (err) {
    console.error(`Error during initialization: ${err.message}`);
    process.exit(1);
  }
}

export default initCommand;