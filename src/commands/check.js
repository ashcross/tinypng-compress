import tinify from 'tinify';
import { loadConfig, resetAllKeysIfNeeded, updateKeyUsage } from '../config/index.js';

function formatTable(data) {
  const headers = ['Name', 'Email', 'Used', 'Remaining', 'Status'];
  const columnWidths = [20, 15, 8, 10, 10];
  
  const separator = '┌' + columnWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const headerSeparator = '├' + columnWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const bottom = '└' + columnWidths.map(w => '─'.repeat(w)).join('┴') + '┘';
  
  function padCell(text, width) {
    return text.length > width ? text.substring(0, width - 3) + '...' : text.padEnd(width);
  }
  
  function formatRow(cells) {
    return '│' + cells.map((cell, i) => padCell(cell, columnWidths[i])).join('│') + '│';
  }
  
  const headerRow = formatRow(headers);
  const dataRows = data.map(row => formatRow(row));
  
  return [separator, headerRow, headerSeparator, ...dataRows, bottom].join('\n');
}

function getStatusText(apiKey) {
  switch (apiKey.status) {
    case 'active':
      return 'Active';
    case 'limit_reached':
      return 'Limit';
    case 'invalid':
      return 'Invalid';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Unknown';
  }
}

async function checkApiKey(apiKey) {
  try {
    tinify.key = apiKey.key;
    
    await new Promise((resolve, reject) => {
      tinify.validate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const currentUsage = tinify.compressionCount || 0;
    
    return {
      valid: true,
      usage: currentUsage,
      status: currentUsage >= 500 ? 'limit_reached' : 'active'
    };
    
  } catch (err) {
    return {
      valid: false,
      usage: apiKey.compressions_used,
      status: 'invalid',
      error: err.message
    };
  }
}

async function checkCommand() {
  try {
    const config = loadConfig();
    
    if (config.apiKeys.length === 0) {
      console.log('No API keys configured. Run --init to add API keys.');
      return;
    }
    
    resetAllKeysIfNeeded(config);
    
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    console.log(`API Key Usage Report - ${monthYear}\n`);
    
    const tableData = [];
    let totalRemaining = 0;
    let validKeys = 0;
    
    for (const apiKey of config.apiKeys) {
      const result = await checkApiKey(apiKey);
      
      if (result.valid) {
        updateKeyUsage(config, apiKey.name, result.usage);
        validKeys++;
      }
      
      const remaining = Math.max(0, 500 - result.usage);
      totalRemaining += remaining;
      
      const email = apiKey.email.length > 12 ? 
        apiKey.email.substring(0, 9) + '...' : 
        apiKey.email;
      
      tableData.push([
        apiKey.name,
        email,
        result.usage.toString(),
        remaining.toString(),
        getStatusText({ ...apiKey, status: result.status })
      ]);
    }
    
    const table = formatTable(tableData);
    console.log(table);
    
    console.log(`\nTotal available compressions: ${totalRemaining}`);
    console.log(`Active API keys: ${validKeys}/${config.apiKeys.length}`);
    
    const invalidKeys = config.apiKeys.filter(key => 
      tableData.find(row => row[0] === key.name && row[4] === 'Invalid')
    );
    
    if (invalidKeys.length > 0) {
      console.log(`\nInvalid API keys detected:`);
      invalidKeys.forEach(key => {
        console.log(`  - ${key.name}: Check API key validity`);
      });
    }
    
  } catch (err) {
    console.error(`Error checking API keys: ${err.message}`);
    process.exit(1);
  }
}

export default checkCommand;