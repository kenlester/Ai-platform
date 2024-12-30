#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

class OpenAIMCPServer {
  private server: Server;
  private openai: OpenAI;

  constructor() {
    this.server = new Server(
      {
        name: 'openai-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.openai = new OpenAI({
      apiKey: API_KEY,
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_text',
          description: 'Generate text using OpenAI GPT models',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt to generate text from',
              },
              model: {
                type: 'string',
                description: 'OpenAI model to use (e.g., gpt-4, gpt-3.5-turbo)',
                default: 'gpt-3.5-turbo',
              },
              max_tokens: {
                type: 'number',
                description: 'Maximum tokens in response',
                default: 1000,
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'analyze_code',
          description: 'Analyze code using OpenAI models',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code to analyze',
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
              analysis_type: {
                type: 'string',
                enum: ['security', 'performance', 'style', 'bugs'],
                description: 'Type of analysis to perform',
              },
            },
            required: ['code', 'language', 'analysis_type'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'generate_text': {
            const { prompt, model = 'gpt-3.5-turbo', max_tokens = 1000 } = request.params.arguments;

            const completion = await this.openai.chat.completions.create({
              model,
              messages: [{ role: 'user', content: prompt }],
              max_tokens,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: completion.choices[0].message.content || '',
                },
              ],
            };
          }

          case 'analyze_code': {
            const { code, language, analysis_type } = request.params.arguments;

            const prompt = `Analyze this ${language} code for ${analysis_type} issues:\n\n${code}`;

            const completion = await this.openai.chat.completions.create({
              model: 'gpt-4',
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 1000,
            });

            return {
              content: [
                {
                  type: 'text',
                  text: completion.choices[0].message.content || '',
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        
        throw new McpError(
          ErrorCode.InternalError,
          `OpenAI API error: ${error.message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('OpenAI MCP server running on stdio');
  }
}

const server = new OpenAIMCPServer();
server.run().catch(console.error);
