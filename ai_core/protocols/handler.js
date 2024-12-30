"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolHandler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const rate_limiter_1 = require("../../dev_tools/rate_limiter");
const collector_1 = require("../../data/metrics/collector");
class ProtocolHandler {
    constructor() {
        this.rateLimiter = new rate_limiter_1.RateLimiter();
        this.metrics = new collector_1.MetricsCollector();
        this.messageCache = new Map();
    }
    static getInstance() {
        if (!ProtocolHandler.instance) {
            ProtocolHandler.instance = new ProtocolHandler();
        }
        return ProtocolHandler.instance;
    }
    async handleMessage(message) {
        const startTime = Date.now();
        try {
            // Validate message format
            this.validateMessage(message);
            // Check cache if enabled
            if (message.optimization?.caching) {
                const cached = this.getCachedResponse(message);
                if (cached) {
                    return this.createResponse({
                        ...cached,
                        metrics: {
                            ...cached.metrics,
                            tokens: {
                                input: 0,
                                output: 0,
                                saved: message.metrics?.tokens?.input || 0
                            }
                        }
                    });
                }
            }
            // Apply rate limiting
            const tokens = this.estimateTokens(message);
            await this.rateLimiter.handleRequest(message.sender.id, tokens, async () => {
                // Process message based on intent
                const response = await this.processIntent(message);
                // Cache response if enabled
                if (message.optimization?.caching) {
                    this.cacheResponse(message, response);
                }
                return response;
            });
            // Record metrics
            const latency = Date.now() - startTime;
            this.metrics.recordSuccess(message.intent.action, {
                startTime,
                tokens,
                endpoint: message.intent.action,
                pattern: message.optimization?.pattern_id || null
            });
            return this.createResponse({
                ...message,
                metrics: {
                    tokens: {
                        input: tokens,
                        output: this.estimateTokens(message),
                        saved: 0
                    },
                    latency
                }
            });
        }
        catch (error) {
            return this.handleError(message, error);
        }
    }
    validateMessage(message) {
        // Validate required fields
        if (!message.protocol_version || !message.message_id || !message.sender || !message.intent || !message.content) {
            throw new Error('Missing required fields in message');
        }
        // Validate version format
        if (!/^\d+\.\d+\.\d+$/.test(message.protocol_version)) {
            throw new Error('Invalid protocol version format');
        }
        // Validate message ID format
        if (!/^[a-f0-9]{32}$/.test(message.message_id)) {
            throw new Error('Invalid message ID format');
        }
        // Validate content
        if (!message.content.format || !message.content.data) {
            throw new Error('Invalid content format');
        }
        // Validate security if present
        if (message.security?.checksum) {
            const calculated = this.calculateChecksum(message.content.data);
            if (calculated !== message.security.checksum) {
                throw new Error('Checksum validation failed');
            }
        }
    }
    async processIntent(message) {
        switch (message.intent.type) {
            case 'query':
                return this.processQuery(message);
            case 'response':
                return this.processResponse(message);
            case 'notification':
                return this.processNotification(message);
            case 'pattern':
                return this.processPattern(message);
            case 'optimization':
                return this.processOptimization(message);
            default:
                throw new Error(`Unsupported intent type: ${message.intent.type}`);
        }
    }
    async processQuery(message) {
        // Implement query processing logic
        return {
            status: 'success',
            data: {}
        };
    }
    async processResponse(message) {
        // Implement response processing logic
        return {
            status: 'acknowledged',
            timestamp: new Date().toISOString()
        };
    }
    async processNotification(message) {
        // Implement notification processing logic
        return {
            status: 'received',
            timestamp: new Date().toISOString()
        };
    }
    async processPattern(message) {
        // Implement pattern processing logic
        return {
            pattern_id: crypto_1.default.randomBytes(16).toString('hex'),
            confidence: 0.95,
            matches: []
        };
    }
    async processOptimization(message) {
        // Implement optimization processing logic
        return {
            status: 'optimized',
            improvements: []
        };
    }
    createResponse(message) {
        return {
            protocol_version: message.protocol_version,
            message_id: crypto_1.default.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            sender: {
                id: 'system',
                type: 'service',
                capabilities: ['pattern_recognition', 'optimization']
            },
            intent: {
                type: 'response',
                action: `${message.intent.action}_response`
            },
            content: {
                format: 'json',
                data: message
            },
            metrics: message.metrics
        };
    }
    handleError(message, error) {
        const errorResponse = {
            protocol_version: message.protocol_version,
            message_id: crypto_1.default.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            sender: {
                id: 'system',
                type: 'service',
                capabilities: ['error_handling']
            },
            intent: {
                type: 'error',
                action: 'error_response'
            },
            content: {
                format: 'json',
                data: {
                    error: error.message,
                    original_message: message.message_id
                }
            }
        };
        this.metrics.recordError(message.intent.action, error);
        return errorResponse;
    }
    getCachedResponse(message) {
        const cached = this.messageCache.get(message.message_id);
        if (!cached)
            return null;
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.messageCache.delete(message.message_id);
            return null;
        }
        return cached.message;
    }
    cacheResponse(message, response) {
        if (!message.optimization?.caching?.ttl)
            return;
        this.messageCache.set(message.message_id, {
            message: response,
            timestamp: Date.now(),
            ttl: message.optimization.caching.ttl * 1000
        });
    }
    calculateChecksum(data) {
        return crypto_1.default
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex');
    }
    estimateTokens(message) {
        return rate_limiter_1.RateLimiter.estimateTokens(JSON.stringify(message));
    }
}
exports.ProtocolHandler = ProtocolHandler;
