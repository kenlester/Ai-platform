"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalRateLimiter = exports.BatchProcessor = exports.MessageOptimizer = exports.TokenBucket = void 0;
const perf_hooks_1 = require("perf_hooks");
class TokenBucket {
    constructor(capacity = 80000, timeWindow = 60) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.timeWindow = timeWindow;
        this.lastUpdate = perf_hooks_1.performance.now() / 1000;
        this.queue = [];
    }
    refillTokens() {
        const now = perf_hooks_1.performance.now() / 1000;
        const timePassed = now - this.lastUpdate;
        this.tokens = Math.min(this.capacity, this.tokens + (timePassed * this.capacity / this.timeWindow));
        this.lastUpdate = now;
    }
    async canProcess(tokenCount) {
        return new Promise((resolve) => {
            this.refillTokens();
            if (this.tokens >= tokenCount) {
                this.tokens -= tokenCount;
                resolve(true);
                return;
            }
            // If not enough tokens, add to queue
            this.queue.push({ tokenCount, resolve });
            // Process queue after delay
            setTimeout(() => this.processQueue(), 1000);
        });
    }
    processQueue() {
        if (this.queue.length === 0)
            return;
        this.refillTokens();
        while (this.queue.length > 0) {
            const request = this.queue[0];
            if (this.tokens >= request.tokenCount) {
                this.queue.shift();
                this.tokens -= request.tokenCount;
                request.resolve(true);
            }
            else {
                break;
            }
        }
        // If queue not empty, try again later
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }
    getTokensRemaining() {
        this.refillTokens();
        return this.tokens;
    }
    getQueueLength() {
        return this.queue.length;
    }
}
exports.TokenBucket = TokenBucket;
// Message optimization utilities
class MessageOptimizer {
    static optimizeMessage(message, maxLength = 1000) {
        // Remove redundant whitespace
        message = message.replace(/\s+/g, ' ').trim();
        // Truncate to max length while preserving word boundaries
        if (message.length > maxLength) {
            const truncated = message.substring(0, maxLength);
            const lastSpace = truncated.lastIndexOf(' ');
            return truncated.substring(0, lastSpace);
        }
        return message;
    }
    static estimateTokenCount(message) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(message.length / 4);
    }
}
exports.MessageOptimizer = MessageOptimizer;
// Batch processor for multiple requests
class BatchProcessor {
    constructor(rateLimiter, batchSize = 5, delayBetweenBatches = 1000) {
        this.rateLimiter = rateLimiter;
        this.batchSize = batchSize;
        this.delayBetweenBatches = delayBetweenBatches;
    }
    async processBatch(items, processor) {
        for (let i = 0; i < items.length; i += this.batchSize) {
            const batch = items.slice(i, i + this.batchSize);
            // Process batch items in parallel
            await Promise.all(batch.map(async (item) => {
                await this.rateLimiter.canProcess(1); // Assume 1 token per item for simplicity
                await processor(item);
            }));
            // Wait between batches
            if (i + this.batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
            }
        }
    }
}
exports.BatchProcessor = BatchProcessor;
// Export singleton instance
exports.globalRateLimiter = new TokenBucket();
//# sourceMappingURL=rate_limiter.js.map