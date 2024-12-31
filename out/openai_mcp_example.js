#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const openai_1 = __importDefault(require("openai"));
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
}
class OpenAIMCPServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'openai-mcp-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.openai = new openai_1.default({
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
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
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
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
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
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            }
            catch (error) {
                if (error instanceof types_js_1.McpError)
                    throw error;
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `OpenAI API error: ${error.message}`);
            }
        });
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('OpenAI MCP server running on stdio');
    }
}
const server = new OpenAIMCPServer();
server.run().catch(console.error);
//# sourceMappingURL=openai_mcp_example.js.map