import { resetAllKeysIfNeeded } from '../config/index.js';

/**
 * Select the best available API key for a given number of compressions
 * @param {Object} config - Configuration object with API keys
 * @param {number} requiredCompressions - Number of compressions needed
 * @returns {Object} Selected API key object or null if none available
 */
async function selectBestApiKey(config, requiredCompressions = 1) {
  // Reset monthly usage for all keys if needed
  await resetAllKeysIfNeeded(config);
  
  // Filter keys that have enough remaining compressions
  const availableKeys = config.apiKeys.filter(key => {
    const remaining = 500 - key.compressions_used;
    return remaining >= requiredCompressions && key.status !== 'limit_reached';
  });
  
  if (availableKeys.length === 0) {
    return null;
  }
  
  // Sort by most remaining compressions (best capacity first)
  availableKeys.sort((a, b) => {
    const remainingA = 500 - a.compressions_used;
    const remainingB = 500 - b.compressions_used;
    return remainingB - remainingA;
  });
  
  return availableKeys[0];
}

/**
 * Validate API key selection and ensure it has sufficient capacity
 * @param {string} keyName - Name of the API key ('any' for auto-selection)
 * @param {Object} config - Configuration object
 * @param {number} requiredCompressions - Number of compressions needed
 * @returns {Object} Valid API key object
 * @throws {Error} If no suitable key found
 */
async function validateApiKeySelection(keyName, config, requiredCompressions = 1) {
  // Auto-select best available key
  if (!keyName || keyName === 'any') {
    const selectedKey = await selectBestApiKey(config, requiredCompressions);
    
    if (!selectedKey) {
      const totalRemaining = config.apiKeys.reduce((sum, key) => sum + (500 - key.compressions_used), 0);
      throw new Error(
        `No API key has sufficient capacity for ${requiredCompressions} compressions.\n` +
        `Total remaining across all keys: ${totalRemaining}\n` +
        `Available keys: ${config.apiKeys.map(k => `${k.name} (${500 - k.compressions_used} remaining)`).join(', ')}`
      );
    }
    
    return selectedKey;
  }
  
  // Find specific named key
  const apiKey = config.apiKeys.find(key => key.name === keyName);
  
  if (!apiKey) {
    const availableKeys = config.apiKeys.map(k => k.name).join(', ');
    throw new Error(`API key '${keyName}' not found. Available keys: ${availableKeys}`);
  }
  
  // Check if key has sufficient capacity
  const remaining = 500 - apiKey.compressions_used;
  if (remaining < requiredCompressions) {
    throw new Error(
      `API key '${keyName}' has insufficient capacity.\n` +
      `Required: ${requiredCompressions}, Available: ${remaining}\n` +
      `Use '--api-key any' to auto-select a key with sufficient capacity`
    );
  }
  
  return apiKey;
}

/**
 * Get summary of all API key capacities
 * @param {Object} config - Configuration object
 * @returns {Array} Array of key summaries with remaining capacity
 */
function getApiKeySummary(config) {
  return config.apiKeys.map(key => ({
    name: key.name,
    used: key.compressions_used,
    remaining: 500 - key.compressions_used,
    status: key.status || 'active'
  }));
}

/**
 * Check if any API key has sufficient capacity
 * @param {Object} config - Configuration object
 * @param {number} requiredCompressions - Number of compressions needed
 * @returns {boolean} True if at least one key has capacity
 */
function hasApiKeyCapacity(config, requiredCompressions = 1) {
  return config.apiKeys.some(key => {
    const remaining = 500 - key.compressions_used;
    return remaining >= requiredCompressions && key.status !== 'limit_reached';
  });
}

export {
  selectBestApiKey,
  validateApiKeySelection,
  getApiKeySummary,
  hasApiKeyCapacity
};