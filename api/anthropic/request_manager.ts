import { globalRateLimiter, MessageOptimizer, BatchProcessor } from './rate_limiter';
import fetch from 'node-fetch';

interface RequestOptions {
    retryCount?: number;
    maxRetries?: number;
    backoffMs?: number;
    maxTokens?: number;
}

interface AnthropicError {
    error?: {
        type?: string;
        message?: string;
    };
    name?: string;
}

const DEFAULT_OPTIONS: RequestOptions = {
    retryCount: 0,
    maxRetries: 3,
    backoffMs: 1000,
    maxTokens: 1000
};

export class AnthropicRequestManager {
    private static instance: AnthropicRequestManager;
    private isLowCredit: boolean = false;
    private lastCreditCheck: number = 0;
    private creditCheckInterval: number = 60000; // 1 minute

    private constructor() {}

    static getInstance(): AnthropicRequestManager {
        if (!AnthropicRequestManager.instance) {
            AnthropicRequestManager.instance = new AnthropicRequestManager();
        }
        return AnthropicRequestManager.instance;
    }

    async processRequest<T>(
        request: () => Promise<T>,
        estimatedTokens: number,
        options: RequestOptions = {}
    ): Promise<T> {
        const opts = { ...DEFAULT_OPTIONS, ...options };

        // Check credit status periodically
        await this.checkCreditStatus();
        if (this.isLowCredit) {
            throw new Error('Insufficient credit balance. Please add credits to continue.');
        }

        try {
            // Wait for rate limiter approval
            const canProceed = await globalRateLimiter.canProcess(estimatedTokens);
            if (!canProceed) {
                throw new Error('Rate limit exceeded');
            }

            // Execute request
            return await request();

        } catch (error) {
            if (this.shouldRetry(error as AnthropicError, opts)) {
                // Calculate backoff time
                const backoffTime = opts.backoffMs! * Math.pow(2, opts.retryCount!);
                await new Promise(resolve => setTimeout(resolve, backoffTime));

                // Retry with updated retry count
                return this.processRequest(request, estimatedTokens, {
                    ...opts,
                    retryCount: opts.retryCount! + 1
                });
            }

            throw error;
        }
    }

    private shouldRetry(error: AnthropicError, options: RequestOptions): boolean {
        // Don't retry if max retries reached
        if (options.retryCount! >= options.maxRetries!) {
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

    private async checkCreditStatus(): Promise<void> {
        const now = Date.now();
        if (now - this.lastCreditCheck < this.creditCheckInterval) {
            return;
        }

        try {
            // Make a minimal API call to check credit status
            await this.processRequest(
                async () => {
                    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
                        const error = await response.json() as AnthropicError;
                        throw error;
                    }

                    this.isLowCredit = false;
                    return true;
                },
                10, // Minimal token count for test request
                { maxRetries: 0 } // Don't retry credit check
            );
        } catch (error) {
            const anthropicError = error as AnthropicError;
            if (anthropicError?.error?.type === 'invalid_request_error' && 
                anthropicError?.error?.message?.includes('credit balance is too low')) {
                this.isLowCredit = true;
            }
        }

        this.lastCreditCheck = now;
    }

    // Utility method for batching requests
    async processBatch<T>(
        items: T[],
        processor: (item: T) => Promise<void>,
        options: {
            batchSize?: number;
            delayBetweenBatches?: number;
            estimatedTokensPerItem?: number;
        } = {}
    ): Promise<void> {
        const batchProcessor = new BatchProcessor(
            globalRateLimiter,
            options.batchSize || 5,
            options.delayBetweenBatches || 1000
        );

        await batchProcessor.processBatch(items, async (item) => {
            await this.processRequest(
                () => processor(item),
                options.estimatedTokensPerItem || 100
            );
        });
    }

    // Utility method for optimizing messages
    optimizeMessage(message: string, maxLength?: number): string {
        return MessageOptimizer.optimizeMessage(message, maxLength);
    }

    // Get current rate limit status
    getRateLimitStatus(): { tokensRemaining: number; queueLength: number } {
        return {
            tokensRemaining: globalRateLimiter.getTokensRemaining(),
            queueLength: globalRateLimiter.getQueueLength()
        };
    }
}

// Export singleton instance
export const requestManager = AnthropicRequestManager.getInstance();
