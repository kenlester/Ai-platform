"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicClient = exports.AnthropicClient = void 0;
const request_manager_1 = require("./request_manager");
const local_optimizer_1 = require("./local_optimizer");
const token_analyzer_1 = require("./token_analyzer");
const temperature_optimizer_1 = require("./temperature_optimizer");
const prompt_optimizer_1 = require("./prompt_optimizer");
const node_fetch_1 = __importDefault(require("node-fetch"));
class AnthropicClient {
    constructor() {
        this.defaultModel = 'claude-3-haiku-20240307';
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
    }
    static getInstance() {
        if (!AnthropicClient.instance) {
            AnthropicClient.instance = new AnthropicClient();
        }
        return AnthropicClient.instance;
    }
    async createMessage(request) {
        const startTime = Date.now();
        // Try local optimization first
        const optimizationResult = await local_optimizer_1.localOptimizer.optimizeRequest(request.messages);
        if (!optimizationResult.shouldUseAnthropic) {
            return optimizationResult.response;
        }
        // Get optimal parameters and template based on task type
        const query = request.messages[request.messages.length - 1].content;
        const taskType = temperature_optimizer_1.temperatureOptimizer.analyzeContent(query);
        const optimalTemplate = prompt_optimizer_1.promptOptimizer.getOptimalTemplate(taskType);
        // Extract variables from query and format prompt
        const variables = this.extractVariables(query, optimalTemplate.variables);
        const formattedPrompt = prompt_optimizer_1.promptOptimizer.formatPrompt(optimalTemplate.template, variables);
        const optimizedPrompt = prompt_optimizer_1.promptOptimizer.optimizePrompt(formattedPrompt);
        // Get other optimal parameters
        const optimalParams = token_analyzer_1.tokenAnalyzer.getOptimalParameters(optimizedPrompt);
        const optimalTemperature = temperature_optimizer_1.temperatureOptimizer.getOptimalTemperature(taskType);
        // Prepare optimized messages
        const optimizedMessages = request.messages.map(msg => ({
            ...msg,
            content: msg.content === query ? optimizedPrompt : msg.content
        }));
        // Use token analyzer for estimation
        const estimatedTokens = optimizedMessages.reduce((total, msg) => {
            return total + token_analyzer_1.tokenAnalyzer.predictTokenCount(msg.content);
        }, 0);
        const response = await request_manager_1.requestManager.processRequest(async () => {
            const response = await (0, node_fetch_1.default)('https://api.anthropic.com/v1/messages', {
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
                const error = await response.json();
                throw error;
            }
            const result = await response.json();
            const responseQuality = this.assessResponseQuality(result);
            const promptEfficiency = prompt_optimizer_1.promptOptimizer.analyzePromptEfficiency(optimizedPrompt);
            // Record token usage pattern
            token_analyzer_1.tokenAnalyzer.recordUsage(optimizedPrompt, {
                input_tokens: result.usage.input_tokens,
                output_tokens: result.usage.output_tokens,
                model: request.model || optimalParams.model,
                temperature: request.temperature || optimalTemperature,
                success_rate: 1.0,
                latency: Date.now() - startTime,
                timestamp: Date.now()
            });
            // Record optimization patterns
            temperature_optimizer_1.temperatureOptimizer.recordPattern(taskType, {
                temperature: request.temperature || optimalTemperature,
                success_rate: 1.0,
                output_quality: responseQuality
            });
            prompt_optimizer_1.promptOptimizer.recordTemplateUsage(taskType, optimalTemplate.template, optimalTemplate.variables, {
                success_rate: 1.0,
                token_efficiency: promptEfficiency,
                response_quality: responseQuality
            });
            // Cache the response for future use
            await local_optimizer_1.localOptimizer.recordAnthropicResponse(optimizedPrompt, result, result.usage.input_tokens + result.usage.output_tokens);
            return result;
        }, estimatedTokens);
        return response;
    }
    async processBatch(messages, options = {}) {
        const responses = [];
        await request_manager_1.requestManager.processBatch(messages, async (msg) => {
            const response = await this.createMessage(msg);
            responses.push(response);
        }, {
            batchSize: options.batchSize,
            delayBetweenBatches: options.delayBetweenBatches,
            estimatedTokensPerItem: 1000 // Conservative estimate
        });
        return responses;
    }
    getRateLimitStatus() {
        return request_manager_1.requestManager.getRateLimitStatus();
    }
    setDefaultModel(model) {
        this.defaultModel = model;
    }
    extractVariables(query, requiredVars) {
        const variables = {};
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
    assessResponseQuality(response) {
        // Basic quality assessment based on response characteristics
        let quality = 1.0;
        // Check response length (penalize very short responses)
        const totalLength = response.content.reduce((sum, part) => sum + part.text.length, 0);
        if (totalLength < 50)
            quality *= 0.8;
        if (totalLength < 20)
            quality *= 0.5;
        // Check for error indicators
        const errorPhrases = ['I cannot', 'I am unable', 'I apologize'];
        const hasErrors = errorPhrases.some(phrase => response.content.some(part => part.text.includes(phrase)));
        if (hasErrors)
            quality *= 0.7;
        // Check for code blocks in code-related responses
        if (response.content.some(part => part.text.includes('```'))) {
            quality *= 1.2; // Bonus for structured code responses
        }
        return Math.min(1.0, Math.max(0.1, quality));
    }
}
exports.AnthropicClient = AnthropicClient;
// Export singleton instance
exports.anthropicClient = AnthropicClient.getInstance();
//# sourceMappingURL=client.js.map