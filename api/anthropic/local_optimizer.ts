import { ProtocolHandler, ProtocolMessage } from '../../ai_core/protocols/handler';
import { QdrantClient } from '@qdrant/js-client-rest';
import { LRUCache } from 'lru-cache';
import fetch from 'node-fetch';

interface CacheEntry {
    query: string;
    response: any;
    timestamp: number;
    tokens_saved: number;
}

interface QdrantPayload {
    query: string;
    response: any;
    timestamp: number;
    tokens_saved: number;
}

interface MistralResponse {
    response: string;
}

interface EmbeddingResponse {
    embedding: number[];
}

interface SearchParams {
    vector: number[];
    limit: number;
    score_threshold: number;
}

export class LocalOptimizer {
    private static instance: LocalOptimizer;
    private protocolHandler: ProtocolHandler;
    private qdrantClient: QdrantClient;
    private collectionName: string = 'anthropic_cache';
    private mistralUrl: string = 'http://192.168.137.69:11434';
    private cacheTTL: number = 3600 * 24; // 24 hours
    private memoryCache: LRUCache<string, CacheEntry>;

    private constructor() {
        this.protocolHandler = ProtocolHandler.getInstance();
        this.qdrantClient = new QdrantClient({ url: 'http://192.168.137.34:6333' });
        this.memoryCache = new LRUCache<string, CacheEntry>({
            max: 500, // Maximum number of items
            ttl: this.cacheTTL * 1000, // TTL in milliseconds
            updateAgeOnGet: true, // Reset TTL when item is accessed
            allowStale: false // Don't serve expired items
        });
        this.initializeCollection();
    }

    static getInstance(): LocalOptimizer {
        if (!LocalOptimizer.instance) {
            LocalOptimizer.instance = new LocalOptimizer();
        }
        return LocalOptimizer.instance;
    }

    private async initializeCollection(): Promise<void> {
        try {
            await this.qdrantClient.createCollection(this.collectionName, {
                vectors: { size: 384, distance: 'Cosine' }
            });
        } catch (error) {
            // Collection might already exist
        }
    }

    async optimizeRequest(messages: Array<{ role: string; content: string }>): Promise<{
        shouldUseAnthropic: boolean;
        response?: any;
        tokensSaved?: number;
    }> {
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
        } catch (error) {
            console.error('Local model error:', error);
        }

        // If we get here, we need to use Anthropic
        return { shouldUseAnthropic: true };
    }

    private async checkCache(query: string): Promise<CacheEntry | null> {
        // Check memory cache first
        const cacheKey = Buffer.from(query).toString('base64');
        const memoryCached = this.memoryCache.get(cacheKey);
        if (memoryCached) {
            return memoryCached;
        }

        try {
            // Check vector store if not in memory
            const embedding = await this.getEmbedding(query);
            const searchParams: SearchParams = {
                vector: embedding,
                limit: 1,
                score_threshold: 0.95
            };
            
            const similar = await this.qdrantClient.search(this.collectionName, searchParams);

            if (similar.length > 0 && similar[0].payload) {
                // Safely cast the payload to our expected type
                const payload = similar[0].payload as unknown as QdrantPayload;
                if (this.isValidPayload(payload)) {
                    const entry: CacheEntry = {
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
        } catch (error) {
            console.error('Cache check error:', error);
        }
        return null;
    }

    private isValidPayload(payload: any): payload is QdrantPayload {
        return (
            typeof payload === 'object' &&
            payload !== null &&
            typeof payload.query === 'string' &&
            payload.response !== undefined &&
            typeof payload.timestamp === 'number' &&
            typeof payload.tokens_saved === 'number'
        );
    }

    private async tryLocalModel(query: string): Promise<string> {
        const response = await fetch(`${this.mistralUrl}/api/generate`, {
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

        const result = await response.json() as MistralResponse;
        return result.response;
    }

    private async getEmbedding(text: string): Promise<number[]> {
        const response = await fetch(`${this.mistralUrl}/api/embeddings`, {
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

        const result = await response.json() as EmbeddingResponse;
        return result.embedding;
    }

    private async cacheResponse(query: string, response: any, tokensSaved: number): Promise<void> {
        const cacheEntry: CacheEntry = {
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
            const qdrantPayload: Record<string, unknown> = {
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
        } catch (error) {
            console.error('Cache storage error:', error);
        }
    }

    private isResponseSufficient(response: string, query: string): boolean {
        // Basic validation - can be enhanced
        return response.length >= query.length / 2 && 
               response.length <= query.length * 10 &&
               !response.includes('I cannot') &&
               !response.includes('I am unable');
    }

    async recordAnthropicResponse(query: string, response: any, tokensUsed: number): Promise<void> {
        await this.cacheResponse(query, response, tokensUsed);
    }
}

export const localOptimizer = LocalOptimizer.getInstance();
