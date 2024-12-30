import crypto from 'crypto';
import { RateLimiter } from '../../dev_tools/rate_limiter';
import { MetricsCollector } from '../../data/metrics/collector';

export interface ProtocolMessage {
  protocol_version: string;
  message_id: string;
  timestamp: string;
  sender: {
    id: string;
    type: 'llm' | 'agent' | 'service' | 'human';
    capabilities: string[];
    context?: any;
  };
  intent: {
    type: 'query' | 'response' | 'notification' | 'error' | 'pattern' | 'optimization';
    action: string;
    priority?: number;
    requires_response?: boolean;
  };
  content: {
    format: 'text' | 'json' | 'code' | 'binary' | 'pattern';
    data: any;
    encoding?: 'none' | 'base64' | 'compressed';
    schema?: string;
  };
  optimization?: {
    pattern_id?: string;
    compression?: boolean;
    caching?: {
      ttl: number;
      strategy: 'memory' | 'disk' | 'distributed';
    };
    batch_id?: string;
  };
  metrics?: {
    tokens?: {
      input: number;
      output: number;
      saved: number;
    };
    latency?: number;
    pattern_matches?: Array<{
      id: string;
      confidence: number;
    }>;
  };
  security?: {
    checksum?: string;
    signature?: string;
    encryption?: {
      algorithm: string;
      key_id: string;
    };
  };
}

export class ProtocolHandler {
  private static instance: ProtocolHandler;
  private rateLimiter: RateLimiter;
  private metrics: MetricsCollector;
  private messageCache: Map<string, {
    message: ProtocolMessage;
    timestamp: number;
    ttl: number;
  }>;

  private constructor() {
    this.rateLimiter = new RateLimiter();
    this.metrics = new MetricsCollector();
    this.messageCache = new Map();
  }

  static getInstance(): ProtocolHandler {
    if (!ProtocolHandler.instance) {
      ProtocolHandler.instance = new ProtocolHandler();
    }
    return ProtocolHandler.instance;
  }

  async handleMessage(message: ProtocolMessage): Promise<ProtocolMessage> {
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
    } catch (error: any) {
      return this.handleError(message, error);
    }
  }

  private validateMessage(message: ProtocolMessage): void {
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

  private async processIntent(message: ProtocolMessage): Promise<any> {
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

  private async processQuery(message: ProtocolMessage): Promise<any> {
    // Implement query processing logic
    return {
      status: 'success',
      data: {}
    };
  }

  private async processResponse(message: ProtocolMessage): Promise<any> {
    // Implement response processing logic
    return {
      status: 'acknowledged',
      timestamp: new Date().toISOString()
    };
  }

  private async processNotification(message: ProtocolMessage): Promise<any> {
    // Implement notification processing logic
    return {
      status: 'received',
      timestamp: new Date().toISOString()
    };
  }

  private async processPattern(message: ProtocolMessage): Promise<any> {
    // Implement pattern processing logic
    return {
      pattern_id: crypto.randomBytes(16).toString('hex'),
      confidence: 0.95,
      matches: []
    };
  }

  private async processOptimization(message: ProtocolMessage): Promise<any> {
    // Implement optimization processing logic
    return {
      status: 'optimized',
      improvements: []
    };
  }

  private createResponse(message: ProtocolMessage): ProtocolMessage {
    return {
      protocol_version: message.protocol_version,
      message_id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      sender: {
        id: 'system',
        type: 'service' as const,
        capabilities: ['pattern_recognition', 'optimization']
      },
      intent: {
        type: 'response' as const,
        action: `${message.intent.action}_response`
      },
      content: {
        format: 'json' as const,
        data: message
      },
      metrics: message.metrics
    };
  }

  private handleError(message: ProtocolMessage, error: Error): ProtocolMessage {
    const errorResponse: ProtocolMessage = {
      protocol_version: message.protocol_version,
      message_id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      sender: {
        id: 'system',
        type: 'service' as const,
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

  private getCachedResponse(message: ProtocolMessage): ProtocolMessage | null {
    const cached = this.messageCache.get(message.message_id);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.messageCache.delete(message.message_id);
      return null;
    }

    return cached.message;
  }

  private cacheResponse(message: ProtocolMessage, response: any): void {
    if (!message.optimization?.caching?.ttl) return;

    this.messageCache.set(message.message_id, {
      message: response,
      timestamp: Date.now(),
      ttl: message.optimization.caching.ttl * 1000
    });
  }

  private calculateChecksum(data: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  private estimateTokens(message: ProtocolMessage): number {
    return RateLimiter.estimateTokens(JSON.stringify(message));
  }
}
