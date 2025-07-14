class ConcurrencyManager {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.baseDelay = options.baseDelay || 100;
    this.maxDelay = options.maxDelay || 2000;
    this.adaptiveThrottling = options.adaptiveThrottling !== false;
    
    this.activeRequests = new Set();
    this.requestQueue = [];
    this.metrics = new ConcurrencyMetrics();
    this.rateLimiter = new RateLimiter(this.baseDelay, this.maxDelay);
    
    this.memoryThreshold = options.memoryThreshold || 0.8;
    this.memoryCheckInterval = options.memoryCheckInterval || 5000;
    this.lastMemoryCheck = Date.now();
  }

  async executeWithConcurrency(task, context = {}) {
    const requestId = this.generateRequestId();
    
    try {
      await this.acquireSlot(requestId);
      
      const startTime = Date.now();
      this.activeRequests.add(requestId);
      this.metrics.recordRequestStart(requestId, startTime);
      
      if (this.adaptiveThrottling) {
        const delay = await this.rateLimiter.getOptimalDelay();
        if (delay > 0) {
          await this.delay(delay);
        }
      } else {
        await this.delay(this.baseDelay);
      }
      
      const result = await task();
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      this.metrics.recordRequestSuccess(requestId, responseTime);
      this.rateLimiter.recordSuccess(responseTime);
      
      return result;
      
    } catch (error) {
      this.metrics.recordRequestFailure(requestId, error);
      this.rateLimiter.recordFailure();
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
      this.releaseSlot();
    }
  }

  async acquireSlot(requestId) {
    return new Promise((resolve) => {
      if (this.activeRequests.size < this.maxConcurrent && !this.shouldThrottle()) {
        resolve();
      } else {
        this.requestQueue.push({ requestId, resolve });
      }
    });
  }

  releaseSlot() {
    if (this.requestQueue.length > 0 && !this.shouldThrottle()) {
      const { resolve } = this.requestQueue.shift();
      resolve();
    }
  }

  shouldThrottle() {
    if (this.checkMemoryPressure()) {
      return true;
    }
    
    if (this.rateLimiter.isRateLimited()) {
      return true;
    }
    
    return false;
  }

  checkMemoryPressure() {
    const now = Date.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return false;
    }
    
    this.lastMemoryCheck = now;
    
    try {
      const memoryUsage = process.memoryUsage();
      const heapUsed = memoryUsage.heapUsed;
      const heapTotal = memoryUsage.heapTotal;
      const memoryUtilization = heapUsed / heapTotal;
      
      return memoryUtilization > this.memoryThreshold;
    } catch (error) {
      return false;
    }
  }

  getCurrentConcurrency() {
    return this.activeRequests.size;
  }

  getQueueLength() {
    return this.requestQueue.length;
  }

  getMetrics() {
    return this.metrics.getMetrics();
  }

  adjustConcurrency(newLimit) {
    if (newLimit > 0 && newLimit <= 20) {
      this.maxConcurrent = newLimit;
      
      while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrent) {
        const { resolve } = this.requestQueue.shift();
        resolve();
      }
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy() {
    this.activeRequests.clear();
    this.requestQueue.forEach(({ resolve }) => resolve());
    this.requestQueue = [];
  }
}

class ConcurrencyMetrics {
  constructor() {
    this.activeRequests = new Map();
    this.completedRequests = [];
    this.failedRequests = [];
    this.maxConcurrency = 0;
    this.totalRequests = 0;
  }

  recordRequestStart(requestId, startTime) {
    this.activeRequests.set(requestId, {
      startTime,
      status: 'active'
    });
    
    this.totalRequests++;
    
    if (this.activeRequests.size > this.maxConcurrency) {
      this.maxConcurrency = this.activeRequests.size;
    }
  }

  recordRequestSuccess(requestId, responseTime) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      this.completedRequests.push({
        requestId,
        startTime: request.startTime,
        responseTime,
        status: 'success'
      });
      
      this.activeRequests.delete(requestId);
      
      if (this.completedRequests.length > 1000) {
        this.completedRequests.shift();
      }
    }
  }

  recordRequestFailure(requestId, error) {
    const request = this.activeRequests.get(requestId);
    if (request) {
      this.failedRequests.push({
        requestId,
        startTime: request.startTime,
        error: error.message,
        status: 'failed'
      });
      
      this.activeRequests.delete(requestId);
      
      if (this.failedRequests.length > 500) {
        this.failedRequests.shift();
      }
    }
  }

  getMetrics() {
    const now = Date.now();
    const recentRequests = this.completedRequests.filter(r => now - r.startTime < 60000);
    
    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests.size,
      completedRequests: this.completedRequests.length,
      failedRequests: this.failedRequests.length,
      maxConcurrency: this.maxConcurrency,
      currentConcurrency: this.activeRequests.size,
      averageResponseTime: recentRequests.length > 0 
        ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length 
        : 0,
      throughput: recentRequests.length > 0 
        ? (recentRequests.length / 60) 
        : 0,
      successRate: this.totalRequests > 0 
        ? (this.completedRequests.length / this.totalRequests) * 100 
        : 0
    };
  }
}

class RateLimiter {
  constructor(baseDelay, maxDelay) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.responses = [];
    this.failures = [];
    this.lastRateLimitHit = null;
    this.backoffMultiplier = 1;
    this.maxBackoffMultiplier = 8;
  }

  async getOptimalDelay() {
    const now = Date.now();
    
    if (this.lastRateLimitHit && (now - this.lastRateLimitHit) < 10000) {
      return this.baseDelay * this.backoffMultiplier;
    }
    
    const recentFailures = this.failures.filter(time => now - time < 30000);
    const recentResponses = this.responses.filter(r => now - r.time < 10000);
    
    if (recentFailures.length > 3) {
      this.backoffMultiplier = Math.min(this.maxBackoffMultiplier, this.backoffMultiplier * 1.5);
      return Math.min(this.maxDelay, this.baseDelay * this.backoffMultiplier);
    }
    
    if (recentResponses.length > 0) {
      const avgResponseTime = recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length;
      
      if (avgResponseTime > 3000) {
        return Math.min(this.maxDelay, this.baseDelay * 3);
      } else if (avgResponseTime > 1500) {
        return Math.min(this.maxDelay, this.baseDelay * 2);
      }
    }
    
    this.backoffMultiplier = Math.max(1, this.backoffMultiplier * 0.9);
    return this.baseDelay;
  }

  recordSuccess(responseTime) {
    this.responses.push({
      time: Date.now(),
      responseTime
    });
    
    if (this.responses.length > 100) {
      this.responses.shift();
    }
    
    this.backoffMultiplier = Math.max(1, this.backoffMultiplier * 0.8);
  }

  recordFailure() {
    this.failures.push(Date.now());
    
    if (this.failures.length > 50) {
      this.failures.shift();
    }
    
    this.backoffMultiplier = Math.min(this.maxBackoffMultiplier, this.backoffMultiplier * 1.5);
  }

  recordRateLimit() {
    this.lastRateLimitHit = Date.now();
    this.backoffMultiplier = Math.min(this.maxBackoffMultiplier, this.backoffMultiplier * 2);
  }

  isRateLimited() {
    if (!this.lastRateLimitHit) return false;
    
    const timeSinceRateLimit = Date.now() - this.lastRateLimitHit;
    const backoffTime = this.baseDelay * this.backoffMultiplier;
    
    return timeSinceRateLimit < backoffTime;
  }
}

export { ConcurrencyManager, ConcurrencyMetrics, RateLimiter };