# AI Platform Development Tools

## Rate Limiting and API Management

This directory contains tools for managing API rate limits and costs through intelligent request handling and local model fallback.

### Components

1. **rate_limiter.js**
   - Token bucket implementation
   - Handles rate limit errors
   - Implements exponential backoff
   - Queue management for requests

2. **api_manager.js**
   - High-level API management
   - Automatic fallback to local models
   - Configurable strategies
   - Error handling

3. **api_config.json**
   - Configuration settings
   - Endpoint definitions
   - Model preferences
   - Strategy definitions

### Quick Start

```javascript
const APIManager = require('./api_manager');
const config = require('./api_config.json');

const apiManager = new APIManager({
    tokensPerMinute: config.api.tokensPerMinute,
    useLocalFirst: config.api.useLocalFirst
});

// Cost-optimized usage (prefer local models)
async function generateText(prompt) {
    try {
        const result = await apiManager.generate(prompt, {
            apiEndpoint: config.endpoints.anthropic,
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        return result;
    } catch (error) {
        console.error('Generation failed:', error);
        return null;
    }
}
```

### Rate Limit Management

The system implements several strategies to avoid rate limit errors:

1. **Token Bucketing**
   - Tracks token usage per minute
   - Queues requests when near limit
   - Distributes load over time

2. **Fallback Strategy**
   - Automatic switch to local models when rate limited
   - Configurable fallback preferences
   - Multiple model support

3. **Request Optimization**
   - Request queuing and batching
   - Exponential backoff on failures
   - Token usage estimation

### Configuration

Edit `api_config.json` to customize:

```json
{
    "api": {
        "tokensPerMinute": 80000,
        "useLocalFirst": true
    },
    "strategies": {
        "costOptimized": {
            "useLocalFirst": true,
            "fallbackToAPI": false
        }
    }
}
```

### Best Practices

1. **Cost Management**
   - Use local models for development
   - Enable useLocalFirst for non-critical tasks
   - Monitor token usage

2. **Performance**
   - Configure appropriate retry attempts
   - Use batching for multiple requests
   - Implement request caching

3. **Error Handling**
   - Always implement fallback strategies
   - Log rate limit errors
   - Monitor API response times

### Environment Setup

Required environment variables:
```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### Monitoring

Monitor rate limits and usage:
```javascript
const limiter = new RateLimiter();
console.log('Available tokens:', limiter.tokens);
console.log('Queue length:', limiter.queue.length);
