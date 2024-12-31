export class RateLimiter {
    private maxConcurrent: number = 2; // Strict limit on concurrent requests
    private timeout: number = 30000;
    private activeRequests: Map<string, number> = new Map();
    private dailyTokenLimit: number = 100000; // 100k tokens per day limit
    private tokenUsage: Map<string, number> = new Map();
    private lastReset: number = Date.now();

    static estimateTokens(content: string): number {
        // Rough estimation: ~4 chars per token
        return Math.ceil(content.length / 4);
    }

    setMaxConcurrent(max: number) {
        this.maxConcurrent = max;
    }

    setTimeout(ms: number) {
        this.timeout = ms;
    }

    private resetDailyTokens() {
        const now = Date.now();
        if (now - this.lastReset >= 24 * 60 * 60 * 1000) {
            this.tokenUsage.clear();
            this.lastReset = now;
        }
    }

    private async checkTokenLimit(senderId: string, tokens: number): Promise<boolean> {
        this.resetDailyTokens();
        const currentUsage = this.tokenUsage.get(senderId) || 0;
        if (currentUsage + tokens > this.dailyTokenLimit) {
            console.warn(`Token limit exceeded for ${senderId}: ${currentUsage + tokens}/${this.dailyTokenLimit}`);
            return false;
        }
        return true;
    }

    async handleRequest(
        senderId: string,
        tokens: number,
        handler: () => Promise<any>
    ): Promise<any> {
        const active = this.activeRequests.get(senderId) || 0;
        
        if (active >= this.maxConcurrent) {
            throw new Error(`Rate limit exceeded for sender ${senderId}`);
        }

        if (!(await this.checkTokenLimit(senderId, tokens))) {
            throw new Error(`Daily token limit exceeded for sender ${senderId}`);
        }

        this.activeRequests.set(senderId, active + 1);
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.timeout);
            });

            const result = await Promise.race([handler(), timeoutPromise]);
            
            // Update token usage after successful request
            const currentUsage = this.tokenUsage.get(senderId) || 0;
            this.tokenUsage.set(senderId, currentUsage + tokens);
            
            return result;
        } finally {
            const currentActive = this.activeRequests.get(senderId) || 1;
            if (currentActive <= 1) {
                this.activeRequests.delete(senderId);
            } else {
                this.activeRequests.set(senderId, currentActive - 1);
            }
        }
    }

    getDailyTokenUsage(senderId: string): number {
        this.resetDailyTokens();
        return this.tokenUsage.get(senderId) || 0;
    }

    getRemainingTokens(senderId: string): number {
        const used = this.getDailyTokenUsage(senderId);
        return Math.max(0, this.dailyTokenLimit - used);
    }
}
