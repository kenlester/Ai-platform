// AI Platform Rate Limiter
// Implements token bucket algorithm with minute-based rate limiting

class TokenBucket {
    constructor(tokensPerMinute = 80000, burstSize = tokensPerMinute) {
        this.tokensPerMinute = tokensPerMinute;
        this.burstSize = burstSize;
        this.tokens = burstSize;
        this.lastRefill = Date.now();
        this.tokenAddRate = tokensPerMinute / 60000; // tokens per millisecond
    }

    refill() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const newTokens = timePassed * this.tokenAddRate;
        this.tokens = Math.min(this.burstSize, this.tokens + newTokens);
        this.lastRefill = now;
    }

    tryConsume(tokens) {
        this.refill();
        if (this.tokens >= tokens) {
            this.tokens -= tokens;
            return true;
        }
        return false;
    }

    getWaitTime(tokens) {
        this.refill();
        const missingTokens = tokens - this.tokens;
        if (missingTokens <= 0) return 0;
        return Math.ceil((missingTokens / this.tokenAddRate) * 1000);
    }
}

class RateLimiter {
    constructor() {
        this.buckets = new Map();
        this.defaultLimit = 80000; // Default to Anthropic's limit
        this.requestQueue = [];
        this.isProcessing = false;
    }

    async handleRequest(orgId, tokens, requestFn) {
        if (!this.buckets.has(orgId)) {
            this.buckets.set(orgId, new TokenBucket(this.defaultLimit));
        }

        const bucket = this.buckets.get(orgId);
        
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                orgId,
                tokens,
                requestFn,
                resolve,
                reject,
                attempts: 0,
                maxAttempts: 3
            });
            
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue[0];
            const bucket = this.buckets.get(request.orgId);
            
            if (bucket.tryConsume(request.tokens)) {
                this.requestQueue.shift(); // Remove from queue
                
                try {
                    const result = await request.requestFn();
                    request.resolve(result);
                } catch (error) {
                    if (error.type === 'rate_limit_error' && request.attempts < request.maxAttempts) {
                        // Re-queue with backoff
                        request.attempts++;
                        const waitTime = Math.pow(2, request.attempts) * 1000;
                        setTimeout(() => {
                            this.requestQueue.push(request);
                        }, waitTime);
                    } else {
                        request.reject(error);
                    }
                }
            } else {
                // Calculate wait time and pause processing
                const waitTime = bucket.getWaitTime(request.tokens);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        this.isProcessing = false;
    }

    // Helper to estimate tokens (very rough estimation)
    static estimateTokens(text) {
        // Rough estimation: ~4 chars per token
        return Math.ceil(text.length / 4);
    }
}

// Example usage in VSCode extension:
/*
const rateLimiter = new RateLimiter();

// Wrap API calls:
async function makeAPICall(prompt) {
    const estimatedTokens = RateLimiter.estimateTokens(prompt);
    
    try {
        const response = await rateLimiter.handleRequest(
            'your-org-id',
            estimatedTokens,
            async () => {
                // Your actual API call here
                return await anthropic.messages.create({
                    model: "claude-2",
                    max_tokens: 1000,
                    messages: [{ role: "user", content: prompt }]
                });
            }
        );
        return response;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}
*/

module.exports = {
    RateLimiter,
    TokenBucket
};
