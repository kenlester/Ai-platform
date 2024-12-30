# AI Platform VSCode Extension

## Rate-Limited AI Integration

This extension provides AI capabilities with built-in rate limiting and caching to prevent API quota issues.

### Features

- Token-based rate limiting (80,000 tokens/minute default)
- Request queuing and automatic retries
- Response caching
- Batch processing support
- Configurable settings

### Installation

1. Install dependencies:
```bash
cd dev_tools
npm install
```

2. Build the extension:
```bash
npm run compile
```

3. Set up your API key:
   - Open VSCode Settings
   - Search for "AI Platform"
   - Enter your Anthropic API key

### Usage

1. Single Selection Processing:
   - Select text in editor
   - Press `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (Mac)
   - Or use command palette: "AI Platform: Process Selection"

2. Batch Processing:
   - Make multiple selections (using Alt+Click)
   - Press `Ctrl+Shift+B` (Windows/Linux) or `Cmd+Shift+B` (Mac)
   - Or use command palette: "AI Platform: Batch Process Selections"

### Rate Limiting

The extension implements a token bucket algorithm to manage API rate limits:

- Default limit: 80,000 tokens per minute
- Automatic request queuing when limit reached
- Exponential backoff for retries
- Cache frequently used responses

Configuration in VSCode settings:
```json
{
  "aiPlatform.rateLimit": 80000,
  "aiPlatform.retryAttempts": 3,
  "aiPlatform.cacheTimeout": 300
}
```

### Batch Processing

Efficiently handles multiple selections:

- Automatically combines requests within token limits
- Processes in optimal batches
- Maintains selection order
- Configurable batch size

### Error Handling

The extension provides robust error handling:

- Rate limit detection and automatic retry
- Clear error messages in status bar
- Detailed error logging
- Configurable retry attempts

### Advanced Configuration

Additional settings available:

```json
{
  "aiPlatform.model": "claude-2",
  "aiPlatform.temperature": 0.7,
  "aiPlatform.maxTokens": 1000,
  "aiPlatform.batchSize": 60000
}
```

### Development

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Build:
```bash
npm run compile
```

4. Run tests:
```bash
npm test
```

### Troubleshooting

1. Rate Limit Issues:
   - Check current token usage in status bar
   - Adjust rate limit in settings
   - Increase retry attempts

2. API Errors:
   - Verify API key in settings
   - Check network connectivity
   - Review error messages in Output panel

3. Performance Issues:
   - Adjust batch size
   - Configure cache timeout
   - Monitor token usage

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

### License

MIT License - see LICENSE file

---

For more information, see the [AI Platform Documentation](../README.md)
