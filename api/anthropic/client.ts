import { requestManager } from './request_manager';
import { localOptimizer } from './local_optimizer';
import fetch from 'node-fetch';
import type { Response } from 'node-fetch';

interface MessageRequest {
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    model?: string;
    max_tokens?: number;
    temperature?: number;
    system?: string;
}

interface MessageResponse {
    content: Array<{
        text: string;
        type: string;
    }>;
    model: string;
    role: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface AnthropicError {
    error: {
        type: string;
        message: string;
    };
}

export class AnthropicClient {
    private static instance: AnthropicClient;
    private defaultModel: string = 'claude-3-haiku-20240307';
    private apiKey: string;

    private constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
    }

    static getInstance(): AnthropicClient {
        if (!AnthropicClient.instance) {
            AnthropicClient.instance = new AnthropicClient();
        }
        return AnthropicClient.instance;
    }

    async createMessage(request: MessageRequest): Promise<MessageResponse> {
        // Try local optimization first
        const optimizationResult = await localOptimizer.optimizeRequest(request.messages);
        
        if (!optimizationResult.shouldUseAnthropic) {
            return optimizationResult.response;
        }

        // If local optimization wasn't sufficient, use Anthropic
        const optimizedMessages = request.messages.map(msg => ({
            ...msg,
            content: requestManager.optimizeMessage(msg.content)
        }));

        // Estimate token count
        const estimatedTokens = optimizedMessages.reduce((total, msg) => {
            return total + Math.ceil(msg.content.length / 4);
        }, 0);

        const response = await requestManager.processRequest(
            async () => {
                const response: Response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01',
                        'x-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        messages: optimizedMessages,
                        model: request.model || this.defaultModel,
                        max_tokens: request.max_tokens || 1024,
                        temperature: request.temperature || 0.7,
                        system: request.system
                    })
                });

                if (!response.ok) {
                    const error = await response.json() as AnthropicError;
                    throw error;
                }

                const result = await response.json() as MessageResponse;
                
                // Cache the response for future use
                await localOptimizer.recordAnthropicResponse(
                    request.messages[request.messages.length - 1].content,
                    result,
                    result.usage.input_tokens + result.usage.output_tokens
                );
                
                return result;
            },
            estimatedTokens
        );

        return response;
    }

    async processBatch(
        messages: MessageRequest[],
        options: {
            batchSize?: number;
            delayBetweenBatches?: number;
        } = {}
    ): Promise<MessageResponse[]> {
        const responses: MessageResponse[] = [];

        await requestManager.processBatch(
            messages,
            async (msg) => {
                const response = await this.createMessage(msg);
                responses.push(response);
            },
            {
                batchSize: options.batchSize,
                delayBetweenBatches: options.delayBetweenBatches,
                estimatedTokensPerItem: 1000 // Conservative estimate
            }
        );

        return responses;
    }

    getRateLimitStatus() {
        return requestManager.getRateLimitStatus();
    }

    setDefaultModel(model: string) {
        this.defaultModel = model;
    }
}

// Export singleton instance
export const anthropicClient = AnthropicClient.getInstance();
