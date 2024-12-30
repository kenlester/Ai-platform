// Rate Limiter for API Requests
// Implements token bucket algorithm with fallback strategy

class RateLimiter {
    constructor(tokensPerMinute = 80000, maxBurst = tokensPerMinute) {
        this.tokensPerMinute = tokensPerMinute;
        this.maxBurst = maxBurst;
        this.tokens = maxBurst;
        this.lastRefill = Date.now();
        this.queue = [];
        this.processing = false;
    }

    async refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        const refillAmount = (timePassed / 60000) * this.tokensPerMinute;
        this.tokens = Math.min(this.maxBurst, this.tokens + refillAmount);
        this.lastRefill = now;
    }

    async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            await this.refillTokens();
            
            if (this.tokens < this.queue[0].tokens) {
                // Not enough tokens, wait and try again
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            const request = this.queue.shift();
            this.tokens -= request.tokens;
            
            try {
                const result = await request.execute();
                request.resolve(result);
            } catch (error) {
                if (error.type === 'rate_limit_error') {
                    // If we still hit rate limit, implement exponential backoff
                    const backoffTime = Math.min(1000 * Math.pow(2, request.retries), 32000);
                    request.retries = (request.retries || 0) + 1;
                    
                    if (request.retries <= 5) {
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                        this.queue.unshift(request);
                    } else {
                        request.reject(new Error('Max retries exceeded'));
                    }
                } else {
                    request.reject(error);
                }
            }
        }

        this.processing = false;
    }

    async executeRequest(tokenCost, execute) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                tokens: tokenCost,
                execute,
                resolve,
                reject,
                retries: 0
            });
            this.processQueue();
        });
    }

    // Helper to estimate token count from text
    static estimateTokens(text) {
        // Rough estimation: ~4 chars per token
        return Math.ceil(text.length / 4);
    }
}

// Example usage:
/*
const limiter = new RateLimiter();

// Example API call with rate limiting
async function makeAPICall(prompt) {
    const tokenCost = RateLimiter.estimateTokens(prompt);
    
    return limiter.executeRequest(tokenCost, async () => {
        // Your API call here
        const response = await fetch('https://api.example.com', {
            method: 'POST',
            body: JSON.stringify({ prompt })
        });
        return response.json();
    });
}

// Usage with fallback to local model
async function generateText(prompt) {
    try {
        return await makeAPICall(prompt);
    } catch (error) {
        if (error.message === 'Max retries exceeded') {
            // Fallback to local Ollama model
            return fallbackToLocalModel(prompt);
        }
        throw error;
    }
}
*/

module.exports = RateLimiter;
