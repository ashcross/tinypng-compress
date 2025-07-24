import { compressWithRetry } from './index.js';
import path from 'path';

class BatchProcessor {
  constructor(config = {}) {
    this.maxConcurrent = config.maxConcurrent || 3;
    this.requestDelay = config.requestDelay || 100;
    this.retryAttempts = config.retryAttempts || 3;
    this.adaptiveRateLimit = config.adaptiveRateLimit !== false;
    
    this.activePromises = new Set();
    this.semaphore = new Semaphore(this.maxConcurrent);
    this.rateMonitor = new RateMonitor();
    this.circuitBreaker = new CircuitBreaker();
    
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalFiles: 0,
      startTime: null,
      currentThroughput: 0,
      estimatedTimeRemaining: 0
    };
  }

  async processBatch(files, apiKey, options = {}) {
    this.stats.totalFiles = files.length;
    this.stats.startTime = Date.now();
    
    const results = {
      successful: [],
      failed: [],
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      totalSavings: 0,
      processingTime: 0,
      finalCompressionCount: apiKey.compressions_used,
      concurrentMetrics: {
        maxConcurrent: this.maxConcurrent,
        avgConcurrency: 0,
        peakConcurrency: 0,
        totalRequests: 0,
        avgResponseTime: 0
      }
    };

    // Process files in batches to prevent memory issues with large datasets
    const batchSize = Math.min(files.length, this.maxConcurrent * 10);
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const processingPromises = batch.map(file => 
        this.processFileWithConcurrency(file, apiKey, options, results)
      );

      await Promise.allSettled(processingPromises);
      
      // Perform garbage collection hint for large batches
      if (files.length > 100 && i % (batchSize * 2) === 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }

    results.processingTime = Date.now() - this.stats.startTime;
    results.concurrentMetrics = this.calculateConcurrentMetrics();

    return results;
  }

  async processFileWithConcurrency(file, apiKey, options, results) {
    await this.semaphore.acquire();
    
    try {
      this.activePromises.add(file.path);
      
      if (this.circuitBreaker.shouldBlock()) {
        throw new Error('Circuit breaker is open - too many consecutive failures');
      }

      if (results.finalCompressionCount >= 500) {
        throw new Error('API key reached monthly limit');
      }

      const startTime = Date.now();
      
      if (this.adaptiveRateLimit) {
        const delay = this.rateMonitor.getOptimalDelay();
        if (delay > 0) {
          await this.delay(delay);
        }
      } else {
        await this.delay(this.requestDelay);
      }

      const compressionOptions = {
        preserveMetadata: options.preserveMetadata,
        convert: options.convert,
        maxSize: options.maxSize,
        maxSide: options.maxSide
      };

      const result = await compressWithRetry(file.path, apiKey, compressionOptions);
      
      const responseTime = Date.now() - startTime;
      this.rateMonitor.recordSuccess(responseTime);
      this.circuitBreaker.recordSuccess();

      results.successful.push({
        file: file.path,
        outputPath: result.outputPath,
        ...result
      });

      results.totalOriginalSize += result.originalSize;
      results.totalCompressedSize += result.compressedSize;
      results.totalSavings += result.savings;
      results.finalCompressionCount = result.compressionCount;

      this.updateStats(true, result.savings);
      
      return result;

    } catch (error) {
      this.rateMonitor.recordFailure();
      this.circuitBreaker.recordFailure();
      
      results.failed.push({
        file: file.path,
        error: error.message,
        reason: error.name || 'unknown'
      });

      this.updateStats(false, 0);
      
      throw error;
    } finally {
      this.activePromises.delete(file.path);
      this.semaphore.release();
    }
  }

  updateStats(success, savings = 0) {
    this.stats.processed++;
    if (success) {
      this.stats.successful++;
      this.stats.totalSavings += savings;
    } else {
      this.stats.failed++;
    }

    const elapsed = Date.now() - this.stats.startTime;
    this.stats.currentThroughput = (this.stats.processed / elapsed) * 1000;
    
    if (this.stats.processed > 0) {
      const remainingFiles = this.stats.totalFiles - this.stats.processed;
      this.stats.estimatedTimeRemaining = remainingFiles / this.stats.currentThroughput;
    }
  }

  calculateConcurrentMetrics() {
    return {
      maxConcurrent: this.maxConcurrent,
      avgConcurrency: this.rateMonitor.getAverageConcurrency(),
      peakConcurrency: this.rateMonitor.getPeakConcurrency(),
      totalRequests: this.rateMonitor.getTotalRequests(),
      avgResponseTime: this.rateMonitor.getAverageResponseTime()
    };
  }

  getStats() {
    return { ...this.stats };
  }

  getCurrentConcurrency() {
    return this.activePromises.size;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise(resolve => {
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const resolve = this.queue.shift();
      resolve();
    }
  }
}

class RateMonitor {
  constructor() {
    this.responses = [];
    this.failures = [];
    this.baseDelay = 100;
    this.maxDelay = 2000;
    this.peakConcurrency = 0;
    this.totalRequests = 0;
    this.concurrencyHistory = [];
  }

  recordSuccess(responseTime) {
    this.responses.push({
      time: Date.now(),
      responseTime: responseTime
    });
    
    this.totalRequests++;
    
    if (this.responses.length > 100) {
      this.responses.shift();
    }
  }

  recordFailure() {
    this.failures.push(Date.now());
    
    if (this.failures.length > 50) {
      this.failures.shift();
    }
  }

  getOptimalDelay() {
    const now = Date.now();
    const recentFailures = this.failures.filter(time => now - time < 30000);
    
    if (recentFailures.length === 0) {
      return this.baseDelay;
    }

    const recentResponses = this.responses.filter(r => now - r.time < 10000);
    
    if (recentResponses.length === 0) {
      return this.baseDelay * 2;
    }

    const avgResponseTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length;
    
    if (avgResponseTime > 3000) {
      return Math.min(this.maxDelay, this.baseDelay * 3);
    } else if (avgResponseTime > 1500) {
      return Math.min(this.maxDelay, this.baseDelay * 2);
    }
    
    return this.baseDelay;
  }

  getAverageResponseTime() {
    if (this.responses.length === 0) return 0;
    return this.responses.reduce((sum, r) => sum + r.responseTime, 0) / this.responses.length;
  }

  getAverageConcurrency() {
    if (this.concurrencyHistory.length === 0) return 0;
    return this.concurrencyHistory.reduce((sum, c) => sum + c, 0) / this.concurrencyHistory.length;
  }

  getPeakConcurrency() {
    return this.peakConcurrency;
  }

  getTotalRequests() {
    return this.totalRequests;
  }

  recordConcurrency(current) {
    this.concurrencyHistory.push(current);
    if (current > this.peakConcurrency) {
      this.peakConcurrency = current;
    }
    
    if (this.concurrencyHistory.length > 1000) {
      this.concurrencyHistory.shift();
    }
  }
}

class CircuitBreaker {
  constructor() {
    this.failureThreshold = 5;
    this.timeoutMs = 30000;
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
  }

  shouldBlock() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }
}

export { BatchProcessor };