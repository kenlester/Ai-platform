"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestManager = exports.AnthropicRequestManager = void 0;
const rate_limiter_1 = require("./rate_limiter");
const node_fetch_1 = __importDefault(require("node-fetch"));
const DEFAULT_OPTIONS = {
    retryCount: 0,
    maxRetries: 3,
    backoffMs: 1000,
    maxTokens: 1000
};
class AnthropicRequestManager {
    constructor() {
        this.isLowCredit = false;
        this.lastCreditCheck = 0;
        this.creditCheckInterval = 60000; // 1 minute
    }
    static getInstance() {
        if (!AnthropicRequestManager.instance) {
            AnthropicRequestManager.instance = new AnthropicRequestManager();
        }
        return AnthropicRequestManager.instance;
    }
    async processRequest(request, estimatedTokens, options = {}) {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        // Check credit status periodically
        await this.checkCreditStatus();
        if (this.isLowCredit) {
            throw new Error('Insufficient credit balance. Please add credits to continue.');
        }
        try {
            // Wait for rate limiter approval
            const canProceed = await rate_limiter_1.globalRateLimiter.canProcess(estimatedTokens);
            if (!canProceed) {
                throw new Error('Rate limit exceeded');
            }
            // Execute request
            return await request();
        }
        catch (error) {
            if (this.shouldRetry(error, opts)) {
                // Calculate backoff time
                const backoffTime = opts.backoffMs * Math.pow(2, opts.retryCount);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                // Retry with updated retry count
                return this.processRequest(request, estimatedTokens, {
                    ...opts,
                    retryCount: opts.retryCount + 1
                });
            }
            throw error;
        }
    }
    shouldRetry(error, options) {
        // Don't retry if max retries reached
        if (options.retryCount >= options.maxRetries) {
            return false;
        }
        // Retry on rate limit errors
        if (error?.error?.type === 'rate_limit_error') {
            return true;
        }
        // Retry on certain network errors
        if (error?.name === 'NetworkError' || error?.name === 'TimeoutError') {
            return true;
        }
        // Don't retry on low credit balance
        if (error?.error?.type === 'invalid_request_error' &&
            error?.error?.message?.includes('credit balance is too low')) {
            this.isLowCredit = true;
            return false;
        }
        return false;
    }
    async checkCreditStatus() {
        const now = Date.now();
        if (now - this.lastCreditCheck < this.creditCheckInterval) {
            return;
        }
        try {
            // Make a minimal API call to check credit status
            await this.processRequest(async () => {
                const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'x-api-key': process.env.ANTHROPIC_API_KEY || ''
                    },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: 'test' }],
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1
                    })
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw error;
                }
                this.isLowCredit = false;
                return true;
            }, 10, // Minimal token count for test request
            { maxRetries: 0 } // Don't retry credit check
            );
        }
        catch (error) {
            const anthropicError = error;
            if (anthropicError?.error?.type === 'invalid_request_error' &&
                anthropicError?.error?.message?.includes('credit balance is too low')) {
                this.isLowCredit = true;
            }
        }
        this.lastCreditCheck = now;
    }
    // Utility method for batching requests
    async processBatch(items, processor, options = {}) {
        const batchProcessor = new rate_limiter_1.BatchProcessor(rate_limiter_1.globalRateLimiter, options.batchSize || 5, options.delayBetweenBatches || 1000);
        await batchProcessor.processBatch(items, async (item) => {
            await this.processRequest(() => processor(item), options.estimatedTokensPerItem || 100);
        });
    }
    // Utility method for optimizing messages
    optimizeMessage(message, maxLength) {
        return rate_limiter_1.MessageOptimizer.optimizeMessage(message, maxLength);
    }
    // Get current rate limit status
    getRateLimitStatus() {
        return {
            tokensRemaining: rate_limiter_1.globalRateLimiter.getTokensRemaining(),
            queueLength: rate_limiter_1.globalRateLimiter.getQueueLength()
        };
    }
}
exports.AnthropicRequestManager = AnthropicRequestManager;
// Export singleton instance
exports.requestManager = AnthropicRequestManager.getInstance();
//# sourceMappingURL=request_manager.js.map