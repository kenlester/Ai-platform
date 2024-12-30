import { Request, Response, NextFunction } from 'express';
import { ProtocolHandler } from './handler';
import crypto from 'crypto';

// Re-export ProtocolMessage interface from handler
import type { ProtocolMessage } from './handler';

interface ProtocolRequest extends Request {
  protocol_message?: ProtocolMessage;
}

export const protocolMiddleware = async (req: ProtocolRequest, res: Response, next: NextFunction) => {
  const protocolHandler = ProtocolHandler.getInstance();
  
  try {
    // Create protocol message from request
    const message: ProtocolMessage = {
      protocol_version: '1.0.0',
      message_id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      sender: {
        id: req.headers['x-sender-id']?.toString() || 'anonymous',
        type: (req.headers['x-sender-type']?.toString() || 'service') as 'llm' | 'agent' | 'service' | 'human',
        capabilities: req.headers['x-capabilities']?.toString()?.split(',') || []
      },
      intent: {
        type: (req.method === 'GET' ? 'query' : 'notification') as 'query' | 'notification',
        action: req.path.substring(1),
        priority: parseInt(req.headers['x-priority']?.toString() || '3'),
        requires_response: req.method !== 'HEAD'
      },
      content: {
        format: (req.headers['content-type']?.includes('json') ? 'json' : 'text') as 'json' | 'text',
        data: req.body,
        encoding: 'none' as const
      },
      optimization: req.headers['x-optimize'] ? {
        compression: req.headers['x-compress'] === 'true',
        caching: req.headers['x-cache'] ? {
          ttl: parseInt(req.headers['x-cache-ttl']?.toString() || '3600'),
          strategy: 'memory' as const
        } : undefined
      } : undefined
    };

    // Handle protocol message
    const response = await protocolHandler.handleMessage(message);

    // Attach protocol message to request for later use
    req.protocol_message = response;

    next();
  } catch (error: any) {
    res.status(400).json({
      error: 'Protocol Error',
      message: error.message
    });
  }
};

export const protocolResponseHandler = (req: ProtocolRequest, res: Response) => {
  if (!req.protocol_message) {
    return res.status(500).json({
      error: 'Protocol Error',
      message: 'No protocol message found'
    });
  }

  // Set protocol-specific headers
  res.setHeader('x-protocol-version', req.protocol_message.protocol_version);
  res.setHeader('x-message-id', req.protocol_message.message_id);
  
  if (req.protocol_message.metrics?.tokens) {
    const totalTokens = req.protocol_message.metrics.tokens.input +
                       req.protocol_message.metrics.tokens.output -
                       req.protocol_message.metrics.tokens.saved;
    res.setHeader('x-tokens-used', totalTokens);
    res.setHeader('x-processing-time', req.protocol_message.metrics.latency || 0);
  }

  // Send protocol response
  res.json(req.protocol_message);
};

export const attachProtocol = (router: any) => {
  // Wrap all routes with protocol handling
  const routes = router.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods)
    }));

  // Clear existing routes
  router.stack = router.stack.filter((layer: any) => !layer.route);

  // Re-add routes with protocol middleware
  routes.forEach((route: any) => {
    route.methods.forEach((method: string) => {
      router[method.toLowerCase()](
        route.path,
        protocolMiddleware,
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            // Original route handler will populate req.protocol_message.content.data
            await next();
            // Send protocol-formatted response
            protocolResponseHandler(req as ProtocolRequest, res);
          } catch (error: any) {
            next(error);
          }
        }
      );
    });
  });

  return router;
};
