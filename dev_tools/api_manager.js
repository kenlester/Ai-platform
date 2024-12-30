// API Manager with Rate Limiting and Local Fallback
const RateLimiter = require('./rate_limiter');
const fetch = require('node-fetch');

class APIManager {
    constructor(config = {}) {
        this.limiter = new RateLimiter(
            config.tokensPerMinute || 80000,
            config.maxBurst || 80000
        );
        this.ollamaEndpoint = config.ollamaEndpoint || 'http://localhost:11434';
        this.useLocalFirst = config.useLocalFirst || false;
    }

    async generateWithAPI(prompt, apiEndpoint, apiKey) {
        const tokenCost = RateLimiter.estimateTokens(prompt);
        
        return this.limiter.executeRequest(tokenCost, async () => {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const error = await response.json();
                throw error;
            }

            return response.json();
        });
    }

    async generateWithOllama(prompt, model = 'mistral') {
        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    prompt
                })
            });

            if (!response.ok) {
                throw new Error('Ollama request failed');
            }

            return response.json();
        } catch (error) {
            console.error('Ollama error:', error);
            throw error;
        }
    }

    async generate(prompt, options = {}) {
        const strategy = this.useLocalFirst ? 'local-first' : 'api-first';
        
        switch (strategy) {
            case 'local-first':
                try {
                    return await this.generateWithOllama(prompt);
                } catch (error) {
                    console.log('Falling back to API due to local error');
                    return this.generateWithAPI(
                        prompt,
                        options.apiEndpoint,
                        options.apiKey
                    );
                }
            
            case 'api-first':
                try {
                    return await this.generateWithAPI(
                        prompt,
                        options.apiEndpoint,
                        options.apiKey
                    );
                } catch (error) {
                    if (error.type === 'rate_limit_error' || 
                        error.message === 'Max retries exceeded') {
                        console.log('Falling back to local model due to rate limit');
                        return this.generateWithOllama(prompt);
                    }
                    throw error;
                }
        }
    }
}

// Example usage:
/*
const apiManager = new APIManager({
    tokensPerMinute: 80000,
    useLocalFirst: true  // Prefer local model to save costs
});

async function example() {
    try {
        const result = await apiManager.generate(
            "What is the meaning of life?",
            {
                apiEndpoint: "https://api.anthropic.com/v1/complete",
                apiKey: "your-api-key"
            }
        );
        console.log(result);
    } catch (error) {
        console.error('Generation failed:', error);
    }
}
*/

module.exports = APIManager;
