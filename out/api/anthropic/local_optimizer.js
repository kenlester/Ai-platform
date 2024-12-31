"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localOptimizer = exports.LocalOptimizer = void 0;
const handler_1 = require("../../ai_core/protocols/handler");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const lru_cache_1 = require("lru-cache");
const node_fetch_1 = __importDefault(require("node-fetch"));
class LocalOptimizer {
    constructor() {
        this.collectionName = 'anthropic_cache';
        this.mistralUrl = 'http://192.168.137.69:11434';
        this.cacheTTL = 3600 * 24; // 24 hours
        this.protocolHandler = handler_1.ProtocolHandler.getInstance();
        this.qdrantClient = new js_client_rest_1.QdrantClient({ url: 'http://192.168.137.34:6333' });
        this.memoryCache = new lru_cache_1.LRUCache({
            max: 500,
            ttl: this.cacheTTL * 1000,
            updateAgeOnGet: true,
            allowStale: false // Don't serve expired items
        });
        this.initializeCollection();
    }
    static getInstance() {
        if (!LocalOptimizer.instance) {
            LocalOptimizer.instance = new LocalOptimizer();
        }
        return LocalOptimizer.instance;
    }
    async initializeCollection() {
        try {
            await this.qdrantClient.createCollection(this.collectionName, {
                vectors: { size: 384, distance: 'Cosine' }
            });
        }
        catch (error) {
            // Collection might already exist
        }
    }
    async optimizeRequest(messages) {
        const query = messages[messages.length - 1].content;
        // Check cache first
        const cachedResponse = await this.checkCache(query);
        if (cachedResponse) {
            return {
                shouldUseAnthropic: false,
                response: cachedResponse.response,
                tokensSaved: cachedResponse.tokens_saved
            };
        }
        // Try local Mistral model
        try {
            const mistralResponse = await this.tryLocalModel(query);
            if (this.isResponseSufficient(mistralResponse, query)) {
                // Cache the successful response
                await this.cacheResponse(query, mistralResponse, 100); // Estimate tokens saved
                return {
                    shouldUseAnthropic: false,
                    response: {
                        content: [{ text: mistralResponse, type: 'text' }],
                        model: 'mistral-local',
                        role: 'assistant',
                        usage: { input_tokens: 0, output_tokens: 0 }
                    },
                    tokensSaved: 100
                };
            }
        }
        catch (error) {
            console.error('Local model error:', error);
        }
        // If we get here, we need to use Anthropic
        return { shouldUseAnthropic: true };
    }
    async checkCache(query) {
        // Check memory cache first
        const cacheKey = Buffer.from(query).toString('base64');
        const memoryCached = this.memoryCache.get(cacheKey);
        if (memoryCached) {
            return memoryCached;
        }
        try {
            // Check vector store if not in memory
            const embedding = await this.getEmbedding(query);
            const searchParams = {
                vector: embedding,
                limit: 1,
                score_threshold: 0.95
            };
            const similar = await this.qdrantClient.search(this.collectionName, searchParams);
            if (similar.length > 0 && similar[0].payload) {
                // Safely cast the payload to our expected type
                const payload = similar[0].payload;
                if (this.isValidPayload(payload)) {
                    const entry = {
                        query: payload.query,
                        response: payload.response,
                        timestamp: payload.timestamp,
                        tokens_saved: payload.tokens_saved
                    };
                    if (Date.now() - entry.timestamp < this.cacheTTL * 1000) {
                        // Cache in memory for faster subsequent access
                        this.memoryCache.set(cacheKey, entry);
                        return entry;
                    }
                }
            }
        }
        catch (error) {
            console.error('Cache check error:', error);
        }
        return null;
    }
    isValidPayload(payload) {
        return (typeof payload === 'object' &&
            payload !== null &&
            typeof payload.query === 'string' &&
            payload.response !== undefined &&
            typeof payload.timestamp === 'number' &&
            typeof payload.tokens_saved === 'number');
    }
    async tryLocalModel(query) {
        const response = await (0, node_fetch_1.default)(`${this.mistralUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'mistral',
                prompt: query,
                temperature: 0.7,
                max_tokens: 1000
            })
        });
        if (!response.ok) {
            throw new Error('Local model request failed');
        }
        const result = await response.json();
        return result.response;
    }
    async getEmbedding(text) {
        const response = await (0, node_fetch_1.default)(`${this.mistralUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'mistral',
                prompt: text
            })
        });
        if (!response.ok) {
            throw new Error('Embedding request failed');
        }
        const result = await response.json();
        return result.embedding;
    }
    async cacheResponse(query, response, tokensSaved) {
        const cacheEntry = {
            query,
            response,
            timestamp: Date.now(),
            tokens_saved: tokensSaved
        };
        try {
            // Cache in memory
            const cacheKey = Buffer.from(query).toString('base64');
            this.memoryCache.set(cacheKey, cacheEntry);
            // Cache in vector store
            const embedding = await this.getEmbedding(query);
            // Convert CacheEntry to a plain object for Qdrant payload
            const qdrantPayload = {
                query: cacheEntry.query,
                response: cacheEntry.response,
                timestamp: cacheEntry.timestamp,
                tokens_saved: cacheEntry.tokens_saved
            };
            await this.qdrantClient.upsert(this.collectionName, {
                points: [{
                        id: cacheKey,
                        vector: embedding,
                        payload: qdrantPayload
                    }]
            });
        }
        catch (error) {
            console.error('Cache storage error:', error);
        }
    }
    isResponseSufficient(response, query) {
        // Basic validation - can be enhanced
        return response.length >= query.length / 2 &&
            response.length <= query.length * 10 &&
            !response.includes('I cannot') &&
            !response.includes('I am unable');
    }
    async recordAnthropicResponse(query, response, tokensUsed) {
        await this.cacheResponse(query, response, tokensUsed);
    }
}
exports.LocalOptimizer = LocalOptimizer;
exports.localOptimizer = LocalOptimizer.getInstance();
//# sourceMappingURL=local_optimizer.js.map