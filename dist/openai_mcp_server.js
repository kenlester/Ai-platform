#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}
const isGenerateTextArgs = (args) => typeof args === 'object' &&
    args !== null &&
    typeof args.prompt === 'string' &&
    (args.model === undefined || typeof args.model === 'string') &&
    (args.max_tokens === undefined || typeof args.max_tokens === 'number');
const isAnalyzeCodeArgs = (args) => typeof args === 'object' &&
    args !== null &&
    typeof args.code === 'string' &&
    typeof args.language === 'string' &&
    typeof args.analysis_type === 'string' &&
    ['security', 'performance', 'style', 'bugs'].includes(args.analysis_type);
class OpenAIMcpServer {
    constructor() {
        this.server = new Server({
            name: 'openai-mcp-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
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
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'generate_text',
                    description: 'Generate text using OpenAI models',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            prompt: {
                                type: 'string',
                                description: 'The prompt for text generation',
                            },
                            model: {
                                type: 'string',
                                description: 'OpenAI model to use (default: gpt-3.5-turbo)',
                            },
                            max_tokens: {
                                type: 'number',
                                description: 'Maximum tokens to generate (default: 1000)',
                            },
                        },
                        required: ['prompt'],
                    },
                },
                {
                    name: 'analyze_code',
                    description: 'Analyze code for various aspects',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            code: {
                                type: 'string',
                                description: 'Code to analyze',
                            },
                            language: {
                                type: 'string',
                                description: 'Programming language of the code',
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
                        if (!isGenerateTextArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid generate_text arguments');
                        }
                        const args = request.params.arguments;
                        const { prompt, model = 'gpt-3.5-turbo', max_tokens = 1000 } = args;
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
                        if (!isAnalyzeCodeArgs(request.params.arguments)) {
                            throw new McpError(ErrorCode.InvalidParams, 'Invalid analyze_code arguments');
                        }
                        const args = request.params.arguments;
                        const { code, language, analysis_type } = args;
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
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (error instanceof McpError) {
                    throw error;
                }
                if (error instanceof Error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                        isError: true,
                    };
                }
                throw error;
            }
        });
    }
    async run() {
        try {
            console.error('Starting OpenAI MCP server...');
            const transport = new StdioServerTransport();
            console.error('Created StdioServerTransport');
            await this.server.connect(transport);
            console.error('Connected transport to server');
            console.error('OpenAI MCP server running on stdio');
        }
        catch (error) {
            console.error('Failed to start MCP server:', error);
            throw error;
        }
    }
}
const server = new OpenAIMcpServer();
server.run().catch(console.error);
