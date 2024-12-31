"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor() {
        this.maxConcurrent = 5;
        this.timeout = 30000;
        this.activeRequests = new Map();
    }
    static estimateTokens(content) {
        // Rough estimation: ~4 chars per token
        return Math.ceil(content.length / 4);
    }
    setMaxConcurrent(max) {
        this.maxConcurrent = max;
    }
    setTimeout(ms) {
        this.timeout = ms;
    }
    async handleRequest(senderId, tokens, handler) {
        const active = this.activeRequests.get(senderId) || 0;
        if (active >= this.maxConcurrent) {
            throw new Error(`Rate limit exceeded for sender ${senderId}`);
        }
        this.activeRequests.set(senderId, active + 1);
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.timeout);
            });
            const result = await Promise.race([handler(), timeoutPromise]);
            return result;
        }
        finally {
            const currentActive = this.activeRequests.get(senderId) || 1;
            if (currentActive <= 1) {
                this.activeRequests.delete(senderId);
            }
            else {
                this.activeRequests.set(senderId, currentActive - 1);
            }
        }
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate_limiter.js.map