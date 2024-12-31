import { requestManager } from './request_manager';
import { localOptimizer } from './local_optimizer';
import { tokenAnalyzer } from './token_analyzer';
import { temperatureOptimizer } from './temperature_optimizer';
import { promptOptimizer } from './prompt_optimizer';
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
        const startTime = Date.now();
        
        // Try local optimization first
        const optimizationResult = await localOptimizer.optimizeRequest(request.messages);
        
        if (!optimizationResult.shouldUseAnthropic) {
            return optimizationResult.response;
        }

        // Get optimal parameters and template based on task type
        const query = request.messages[request.messages.length - 1].content;
        const taskType = temperatureOptimizer.analyzeContent(query);
        const optimalTemplate = promptOptimizer.getOptimalTemplate(taskType);
        
        // Extract variables from query and format prompt
        const variables = this.extractVariables(query, optimalTemplate.variables);
        const formattedPrompt = promptOptimizer.formatPrompt(optimalTemplate.template, variables);
        const optimizedPrompt = promptOptimizer.optimizePrompt(formattedPrompt);
        
        // Get other optimal parameters
        const optimalParams = tokenAnalyzer.getOptimalParameters(optimizedPrompt);
        const optimalTemperature = temperatureOptimizer.getOptimalTemperature(taskType);

        // Prepare optimized messages
        const optimizedMessages = request.messages.map(msg => ({
            ...msg,
            content: msg.content === query ? optimizedPrompt : msg.content
        }));

        // Use token analyzer for estimation
        const estimatedTokens = optimizedMessages.reduce((total, msg) => {
            return total + tokenAnalyzer.predictTokenCount(msg.content);
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
                        model: request.model || optimalParams.model,
                        max_tokens: request.max_tokens || 1024,
                        temperature: request.temperature || optimalTemperature,
                        system: request.system
                    })
                });

                if (!response.ok) {
                    const error = await response.json() as AnthropicError;
                    throw error;
                }

                const result = await response.json() as MessageResponse;
                const responseQuality = this.assessResponseQuality(result);
                const promptEfficiency = promptOptimizer.analyzePromptEfficiency(optimizedPrompt);
                
                // Record token usage pattern
                tokenAnalyzer.recordUsage(optimizedPrompt, {
                    input_tokens: result.usage.input_tokens,
                    output_tokens: result.usage.output_tokens,
                    model: request.model || optimalParams.model,
                    temperature: request.temperature || optimalTemperature,
                    success_rate: 1.0, // Assume success if no error
                    latency: Date.now() - startTime,
                    timestamp: Date.now()
                });

                // Record optimization patterns
                temperatureOptimizer.recordPattern(taskType, {
                    temperature: request.temperature || optimalTemperature,
                    success_rate: 1.0,
                    output_quality: responseQuality
                });

                promptOptimizer.recordTemplateUsage(taskType, optimalTemplate.template, optimalTemplate.variables, {
                    success_rate: 1.0,
                    token_efficiency: promptEfficiency,
                    response_quality: responseQuality
                });
                
                // Cache the response for future use
                await localOptimizer.recordAnthropicResponse(
                    optimizedPrompt,
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

    private extractVariables(query: string, requiredVars: string[]): Record<string, string> {
        const variables: Record<string, string> = {};
        
        // Extract code blocks
        if (requiredVars.includes('code')) {
            const codeMatch = query.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
            if (codeMatch) {
                variables.code = codeMatch[1];
            }
        }

        // Extract language
        if (requiredVars.includes('language')) {
            const langMatch = query.match(/(?:in|using|with)\s+(\w+)(?:\s|$)/i);
            if (langMatch) {
                variables.language = langMatch[1];
            }
        }

        // Extract type (function, class, etc.)
        if (requiredVars.includes('type')) {
            const typeMatch = query.match(/(?:create|generate|write)\s+(?:a|an)\s+(\w+)(?:\s|$)/i);
            if (typeMatch) {
                variables.type = typeMatch[1];
            }
        }

        // Extract functionality
        if (requiredVars.includes('functionality')) {
            const funcMatch = query.match(/that\s+([^.]+)/i);
            if (funcMatch) {
                variables.functionality = funcMatch[1];
            }
        }

        // Extract requirements and constraints from lists
        if (requiredVars.includes('requirements')) {
            const reqMatch = query.match(/requirements?:?\s*((?:[-*]\s*[^\n]+\n?)+)/i);
            if (reqMatch) {
                variables.requirements = reqMatch[1];
            }
        }

        if (requiredVars.includes('constraints')) {
            const constMatch = query.match(/constraints?:?\s*((?:[-*]\s*[^\n]+\n?)+)/i);
            if (constMatch) {
                variables.constraints = constMatch[1];
            }
        }

        // Fill in missing required variables with placeholders
        for (const required of requiredVars) {
            if (!variables[required]) {
                variables[required] = `{${required}}`;
            }
        }

        return variables;
    }

    private assessResponseQuality(response: MessageResponse): number {
        // Basic quality assessment based on response characteristics
        let quality = 1.0;

        // Check response length (penalize very short responses)
        const totalLength = response.content.reduce((sum, part) => sum + part.text.length, 0);
        if (totalLength < 50) quality *= 0.8;
        if (totalLength < 20) quality *= 0.5;

        // Check for error indicators
        const errorPhrases = ['I cannot', 'I am unable', 'I apologize'];
        const hasErrors = errorPhrases.some(phrase => 
            response.content.some(part => part.text.includes(phrase))
        );
        if (hasErrors) quality *= 0.7;

        // Check for code blocks in code-related responses
        if (response.content.some(part => part.text.includes('```'))) {
            quality *= 1.2; // Bonus for structured code responses
        }

        return Math.min(1.0, Math.max(0.1, quality));
    }
}

// Export singleton instance
export const anthropicClient = AnthropicClient.getInstance();
