# OpenAI MCP Usage Guide

This guide demonstrates how to use the OpenAI MCP server implementation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Add to MCP settings (in cline_mcp_settings.json):
```json
{
  "mcpServers": {
    "openai": {
      "command": "node",
      "args": ["/path/to/openai_mcp_example.js"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. generate_text
Generates text using OpenAI's GPT models.

Example usage:
```typescript
<use_mcp_tool>
<server_name>openai</server_name>
<tool_name>generate_text</tool_name>
<arguments>
{
  "prompt": "Write a short story about a robot learning to paint",
  "model": "gpt-4",
  "max_tokens": 500
}
</arguments>
</use_mcp_tool>
```

### 2. analyze_code
Analyzes code for security, performance, style, or bugs using OpenAI models.

Example usage:
```typescript
<use_mcp_tool>
<server_name>openai</server_name>
<tool_name>analyze_code</tool_name>
<arguments>
{
  "code": "function fetchData() { return fetch('api/data').then(r => r.json()) }",
  "language": "javascript",
  "analysis_type": "performance"
}
</arguments>
</use_mcp_tool>
```

## Example Workflow

1. Text Generation:
```typescript
// Generate creative writing
<use_mcp_tool>
<server_name>openai</server_name>
<tool_name>generate_text</tool_name>
<arguments>
{
  "prompt": "Write a haiku about programming",
  "model": "gpt-3.5-turbo"
}
</arguments>
</use_mcp_tool>
```

2. Code Analysis:
```typescript
// Analyze code for security issues
<use_mcp_tool>
<server_name>openai</server_name>
<tool_name>analyze_code</tool_name>
<arguments>
{
  "code": `
    app.get('/api/user', (req, res) => {
      const userId = req.query.id;
      const query = 'SELECT * FROM users WHERE id = ' + userId;
      db.query(query).then(user => res.json(user));
    });
  `,
  "language": "javascript",
  "analysis_type": "security"
}
</arguments>
</use_mcp_tool>
```

## Error Handling

The server handles various error cases:
- Invalid API key
- Rate limiting
- Invalid tool parameters
- Network issues

Errors are returned with appropriate error codes and descriptive messages.

## Best Practices

1. Token Management
   - Monitor token usage with max_tokens parameter
   - Use appropriate models for different tasks (gpt-4 for complex analysis, gpt-3.5-turbo for simpler tasks)

2. Error Handling
   - Always handle potential errors in your implementation
   - Check response content for expected format

3. Performance
   - Cache responses when appropriate
   - Use streaming for long-form content generation
