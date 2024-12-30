import { performance } from 'perf_hooks';

export class TokenBucket {
    private capacity: number;
    private tokens: number;
    private timeWindow: number;
    private lastUpdate: number;
    private queue: Array<{
        tokenCount: number;
        resolve: (value: boolean) => void;
    }>;

    constructor(capacity: number = 80000, timeWindow: number = 60) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.timeWindow = timeWindow;
        this.lastUpdate = performance.now() / 1000;
        this.queue = [];
    }

    private refillTokens(): void {
        const now = performance.now() / 1000;
        const timePassed = now - this.lastUpdate;
        this.tokens = Math.min(
            this.capacity,
            this.tokens + (timePassed * this.capacity / this.timeWindow)
        );
        this.lastUpdate = now;
    }

    async canProcess(tokenCount: number): Promise<boolean> {
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

    private processQueue(): void {
        if (this.queue.length === 0) return;

        this.refillTokens();
        
        while (this.queue.length > 0) {
            const request = this.queue[0];
            if (this.tokens >= request.tokenCount) {
                this.queue.shift();
                this.tokens -= request.tokenCount;
                request.resolve(true);
            } else {
                break;
            }
        }

        // If queue not empty, try again later
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    getTokensRemaining(): number {
        this.refillTokens();
        return this.tokens;
    }

    getQueueLength(): number {
        return this.queue.length;
    }
}

// Message optimization utilities
export class MessageOptimizer {
    static optimizeMessage(message: string, maxLength: number = 1000): string {
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

    static estimateTokenCount(message: string): number {
        // Rough estimation: ~4 characters per token
        return Math.ceil(message.length / 4);
    }
}

// Batch processor for multiple requests
export class BatchProcessor {
    private rateLimiter: TokenBucket;
    private batchSize: number;
    private delayBetweenBatches: number;

    constructor(
        rateLimiter: TokenBucket,
        batchSize: number = 5,
        delayBetweenBatches: number = 1000
    ) {
        this.rateLimiter = rateLimiter;
        this.batchSize = batchSize;
        this.delayBetweenBatches = delayBetweenBatches;
    }

    async processBatch<T>(
        items: T[],
        processor: (item: T) => Promise<void>
    ): Promise<void> {
        for (let i = 0; i < items.length; i += this.batchSize) {
            const batch = items.slice(i, i + this.batchSize);
            
            // Process batch items in parallel
            await Promise.all(
                batch.map(async (item) => {
                    await this.rateLimiter.canProcess(1); // Assume 1 token per item for simplicity
                    await processor(item);
                })
            );

            // Wait between batches
            if (i + this.batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
            }
        }
    }
}

// Export singleton instance
export const globalRateLimiter = new TokenBucket();
