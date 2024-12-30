import { RateLimiter } from './rate_limiter';
import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';

interface ClaudeResponse {
    content: string[];
    model: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

interface ClaudeOptions {
    maxTokens?: number;
    temperature?: number;
    model?: string;
}

export class VSCodeAPIManager {
    private static instance: VSCodeAPIManager;
    private rateLimiter: RateLimiter;
    private statusBarItem: vscode.StatusBarItem;
    private context: vscode.ExtensionContext;
    private anthropic: Anthropic;

    private constructor(context: vscode.ExtensionContext) {
        this.rateLimiter = new RateLimiter();
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.show();
        this.updateStatus('Ready');

        // Initialize Anthropic client
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
        this.anthropic = new Anthropic({ apiKey });
    }

    static getInstance(context: vscode.ExtensionContext): VSCodeAPIManager {
        if (!VSCodeAPIManager.instance) {
            VSCodeAPIManager.instance = new VSCodeAPIManager(context);
        }
        return VSCodeAPIManager.instance;
    }

    private updateStatus(status: string) {
        this.statusBarItem.text = `AI: ${status}`;
    }

    async makeAPICall<T>(
        orgId: string,
        prompt: string,
        apiFn: () => Promise<T>
    ): Promise<T> {
        const estimatedTokens = RateLimiter.estimateTokens(prompt);
        
        try {
            this.updateStatus('Processing...');
            
            const response = await this.rateLimiter.handleRequest(
                orgId,
                estimatedTokens,
                async () => {
                    try {
                        return await apiFn();
                    } catch (error: any) {
                        if (error.type === 'rate_limit_error') {
                            this.updateStatus('Rate Limited');
                            vscode.window.showWarningMessage(
                                'API rate limit reached. Request will be retried automatically.'
                            );
                        }
                        throw error;
                    }
                }
            );

            this.updateStatus('Ready');
            return response;

        } catch (error: any) {
            this.updateStatus('Error');
            
            if (error.type === 'rate_limit_error') {
                vscode.window.showErrorMessage(
                    'API rate limit exceeded. Please try again later.'
                );
            } else if (error.type === 'invalid_request_error') {
                vscode.window.showErrorMessage(
                    'Invalid API request. Please check your inputs.'
                );
            } else {
                vscode.window.showErrorMessage(
                    `API call failed: ${error.message || 'Unknown error'}`
                );
            }
            
            throw error;
        }
    }

    async callClaude(
        prompt: string,
        options: ClaudeOptions = {}
    ): Promise<ClaudeResponse> {
        const {
            maxTokens = 1000,
            temperature = 0.7,
            model = 'claude-2'
        } = options;

        return this.makeAPICall(
            'anthropic',
            prompt,
            async () => {
                const response = await this.anthropic.messages.create({
                    model,
                    max_tokens: maxTokens,
                    temperature,
                    messages: [{ role: 'user', content: prompt }]
                });

                return {
                    content: [response.content[0].text],
                    model: response.model,
                    usage: {
                        input_tokens: response.usage.input_tokens,
                        output_tokens: response.usage.output_tokens
                    }
                };
            }
        );
    }

    async batchProcess(prompts: string[]): Promise<ClaudeResponse[]> {
        const batchSize = 60000; // Leave buffer for rate limit
        let currentBatch: string[] = [];
        let currentTokens = 0;
        const batches: string[][] = [];

        for (const prompt of prompts) {
            const tokens = RateLimiter.estimateTokens(prompt);
            if (currentTokens + tokens > batchSize) {
                batches.push([...currentBatch]);
                currentBatch = [prompt];
                currentTokens = tokens;
            } else {
                currentBatch.push(prompt);
                currentTokens += tokens;
            }
        }
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }

        const results: ClaudeResponse[] = [];
        for (const batch of batches) {
            const batchPrompt = batch.join('\n---\n');
            const result = await this.callClaude(batchPrompt);
            results.push(result);
        }

        return results;
    }

    private cache = new Map<string, {
        result: ClaudeResponse;
        timestamp: number;
        tokens: number;
    }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    async callWithCache(
        prompt: string,
        options: ClaudeOptions = {}
    ): Promise<ClaudeResponse> {
        const cacheKey = JSON.stringify({ prompt, options });
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }

        const result = await this.callClaude(prompt, options);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            tokens: RateLimiter.estimateTokens(prompt)
        });

        // Clean old cache entries
        for (const [key, value] of this.cache.entries()) {
            if (Date.now() - value.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
            }
        }

        return result;
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}
