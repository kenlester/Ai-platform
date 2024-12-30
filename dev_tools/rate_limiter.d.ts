export interface TokenBucket {
    tokensPerMinute: number;
    burstSize: number;
    tokens: number;
    lastRefill: number;
    tokenAddRate: number;
    refill(): void;
    tryConsume(tokens: number): boolean;
    getWaitTime(tokens: number): number;
}

export interface RateLimiterRequest {
    orgId: string;
    tokens: number;
    requestFn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    attempts: number;
    maxAttempts: number;
}

export class RateLimiter {
    private buckets: Map<string, TokenBucket>;
    private defaultLimit: number;
    private requestQueue: RateLimiterRequest[];
    private isProcessing: boolean;

    constructor();
    
    handleRequest<T>(
        orgId: string,
        tokens: number,
        requestFn: () => Promise<T>
    ): Promise<T>;
    
    private processQueue(): Promise<void>;
    
    static estimateTokens(text: string): number;
}
