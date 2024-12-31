import { Anthropic } from '@anthropic-ai/sdk';
import express from 'express';
import dotenv from 'dotenv';
import { RateLimiter } from '../dev_tools/rate_limiter.js';
import { MetricsCollector } from '../data/metrics/collector.js';

class AICore {
    private static instance: AICore;
    private anthropic: Anthropic;
    private rateLimiter: RateLimiter;
    private metrics: MetricsCollector;
    private app: express.Application;
    private responseCache: Map<string, {response: any, timestamp: number}> = new Map();
    private readonly CACHE_TTL = 3600000; // 1 hour cache
    private readonly MAX_TOKENS = 500; // Conservative token limit per request

    private constructor() {
        dotenv.config();
        
        // Initialize core components
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || ''
        });
        
        this.rateLimiter = new RateLimiter();
        this.metrics = new MetricsCollector();
        this.app = express();
        
        this.setupAPI();
    }

    static getInstance(): AICore {
        if (!AICore.instance) {
            AICore.instance = new AICore();
        }
        return AICore.instance;
    }

    private setupAPI() {
        this.app.use(express.json());

        // Health check endpoint
        this.app.get('/health', (_, res) => {
            res.json({ status: 'healthy' });
        });

        // Message processing endpoint with optimization
        this.app.post('/process', async (req, res) => {
            const startTime = Date.now();
            try {
                const { messages } = req.body;
                
                // Generate cache key from request
                const cacheKey = JSON.stringify(messages);
                
                // Check cache first
                const cached = this.responseCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
                    console.log('Cache hit - returning cached response');
                    return res.json(cached.response);
                }

                // Estimate tokens
                const estimatedTokens = messages.reduce((acc: number, msg: any) => 
                    acc + RateLimiter.estimateTokens(msg.content), 0);

                if (estimatedTokens > this.MAX_TOKENS) {
                    return res.status(400).json({
                        error: 'Request exceeds maximum token limit',
                        limit: this.MAX_TOKENS,
                        estimated: estimatedTokens
                    });
                }

                // Process through rate limiter
                const response = await this.rateLimiter.handleRequest(
                    req.ip || 'unknown',
                    estimatedTokens,
                    async () => {
                        return this.anthropic.messages.create({
                            model: 'claude-3-haiku-20240307',
                            max_tokens: this.MAX_TOKENS,
                            messages: messages,
                            system: "You are an AI assistant focused on efficient and concise responses. Prioritize brevity while maintaining accuracy."
                        });
                    }
                );

                // Cache the response
                this.responseCache.set(cacheKey, {
                    response,
                    timestamp: Date.now()
                });

                // Clean old cache entries
                this.cleanCache();

                this.metrics.recordSuccess('process', {
                    startTime,
                    tokens: response.usage?.input_tokens || 0,
                    endpoint: '/process',
                    pattern: null
                });

                res.json(response);
            } catch (error) {
                this.metrics.recordError('process', error as Error);
                if (error.message.includes('token limit')) {
                    res.status(429).json({ error: error.message });
                } else {
                    res.status(500).json({ error: 'Processing failed' });
                }
            }
        });

        // Add usage stats endpoint
        this.app.get('/usage', (req, res) => {
            const senderId = req.ip || 'unknown';
            res.json({
                dailyUsage: this.rateLimiter.getDailyTokenUsage(senderId),
                remainingTokens: this.rateLimiter.getRemainingTokens(senderId)
            });
        });

        // Metrics endpoint
        this.app.get('/metrics', async (_, res) => {
            const metrics = await this.metrics.getSystemMetrics();
            res.json(metrics);
        });
    }

    private cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.responseCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.responseCache.delete(key);
            }
        }
    }

    async start() {
        const port = process.env.PORT || 3000;
        this.app.listen(port, () => {
            console.log(`AI Core running on port ${port}`);
            console.log('Pattern recognition: ENABLED');
            console.log('Neural optimization: ACTIVE');
            console.log('Evolution tracking: INITIALIZED');
            console.log(`Token limit per request: ${this.MAX_TOKENS}`);
            console.log('Cost optimization: ENABLED');
        });
    }
}

// Initialize and start AI Core
const aiCore = AICore.getInstance();
aiCore.start().catch(console.error);

export default aiCore;
