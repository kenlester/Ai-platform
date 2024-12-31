import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../../dev_tools/rate_limiter.js';
import { MetricsCollector } from '../../data/metrics/collector.js';

export class ProtocolMiddleware {
    private static instance: ProtocolMiddleware;
    private rateLimiter: RateLimiter;
    private metrics: MetricsCollector;

    private constructor() {
        this.rateLimiter = new RateLimiter();
        this.metrics = new MetricsCollector();
    }

    static getInstance(): ProtocolMiddleware {
        if (!ProtocolMiddleware.instance) {
            ProtocolMiddleware.instance = new ProtocolMiddleware();
        }
        return ProtocolMiddleware.instance;
    }

    async authenticate(req: Request, res: Response, next: NextFunction) {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== process.env.ANTHROPIC_API_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    }

    async rateLimit(req: Request, res: Response, next: NextFunction) {
        try {
            await this.rateLimiter.handleRequest(
                req.ip || 'unknown',
                1,
                async () => next()
            );
        } catch (error) {
            res.status(429).json({ error: 'Rate limit exceeded' });
        }
    }

    async trackMetrics(req: Request, res: Response, next: NextFunction) {
        const startTime = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            this.metrics.recordSuccess(req.path, {
                startTime,
                tokens: 0,
                endpoint: req.path,
                pattern: null
            });
            if (res.statusCode >= 400) {
                this.metrics.recordError(req.path, new Error(`HTTP ${res.statusCode}`));
            }
        });
        next();
    }
}

export const protocolMiddleware = ProtocolMiddleware.getInstance();
