"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeAPIManager = void 0;
const rate_limiter_1 = require("./rate_limiter");
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class VSCodeAPIManager {
    constructor(context) {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.rateLimiter = new rate_limiter_1.RateLimiter();
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.show();
        this.updateStatus('Ready');
        // Initialize Anthropic client
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required');
        }
        this.anthropic = new sdk_1.default({ apiKey });
    }
    static getInstance(context) {
        if (!VSCodeAPIManager.instance) {
            VSCodeAPIManager.instance = new VSCodeAPIManager(context);
        }
        return VSCodeAPIManager.instance;
    }
    updateStatus(status) {
        this.statusBarItem.text = `AI: ${status}`;
    }
    async makeAPICall(orgId, prompt, apiFn) {
        const estimatedTokens = rate_limiter_1.RateLimiter.estimateTokens(prompt);
        try {
            this.updateStatus('Processing...');
            const response = await this.rateLimiter.handleRequest(orgId, estimatedTokens, async () => {
                try {
                    return await apiFn();
                }
                catch (error) {
                    if (error.type === 'rate_limit_error') {
                        this.updateStatus('Rate Limited');
                        vscode.window.showWarningMessage('API rate limit reached. Request will be retried automatically.');
                    }
                    throw error;
                }
            });
            this.updateStatus('Ready');
            return response;
        }
        catch (error) {
            this.updateStatus('Error');
            if (error.type === 'rate_limit_error') {
                vscode.window.showErrorMessage('API rate limit exceeded. Please try again later.');
            }
            else if (error.type === 'invalid_request_error') {
                vscode.window.showErrorMessage('Invalid API request. Please check your inputs.');
            }
            else {
                vscode.window.showErrorMessage(`API call failed: ${error.message || 'Unknown error'}`);
            }
            throw error;
        }
    }
    async callClaude(prompt, options = {}) {
        const { maxTokens = 1000, temperature = 0.7, model = 'claude-2' } = options;
        return this.makeAPICall('anthropic', prompt, async () => {
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
        });
    }
    async batchProcess(prompts) {
        const batchSize = 60000; // Leave buffer for rate limit
        let currentBatch = [];
        let currentTokens = 0;
        const batches = [];
        for (const prompt of prompts) {
            const tokens = rate_limiter_1.RateLimiter.estimateTokens(prompt);
            if (currentTokens + tokens > batchSize) {
                batches.push([...currentBatch]);
                currentBatch = [prompt];
                currentTokens = tokens;
            }
            else {
                currentBatch.push(prompt);
                currentTokens += tokens;
            }
        }
        if (currentBatch.length > 0) {
            batches.push(currentBatch);
        }
        const results = [];
        for (const batch of batches) {
            const batchPrompt = batch.join('\n---\n');
            const result = await this.callClaude(batchPrompt);
            results.push(result);
        }
        return results;
    }
    async callWithCache(prompt, options = {}) {
        const cacheKey = JSON.stringify({ prompt, options });
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }
        const result = await this.callClaude(prompt, options);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            tokens: rate_limiter_1.RateLimiter.estimateTokens(prompt)
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
exports.VSCodeAPIManager = VSCodeAPIManager;
//# sourceMappingURL=vscode_api_manager.js.map