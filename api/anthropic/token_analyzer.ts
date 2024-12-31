import { LRUCache } from 'lru-cache';

interface TokenUsagePattern {
    input_tokens: number;
    output_tokens: number;
    model: string;
    temperature: number;
    success_rate: number;
    latency: number;
    timestamp: number;
}

interface ModelStats {
    total_tokens: number;
    success_rate: number;
    avg_latency: number;
    patterns: TokenUsagePattern[];
}

export class TokenAnalyzer {
    private static instance: TokenAnalyzer;
    private patternCache: LRUCache<string, TokenUsagePattern[]>;
    private modelStats: Map<string, ModelStats>;
    private readonly maxPatternsPerQuery = 100;
    private readonly minSuccessThreshold = 0.85;

    private constructor() {
        this.patternCache = new LRUCache<string, TokenUsagePattern[]>({
            max: 1000, // Store up to 1000 unique queries
            ttl: 24 * 60 * 60 * 1000 // 24 hour TTL
        });
        this.modelStats = new Map();
    }

    static getInstance(): TokenAnalyzer {
        if (!TokenAnalyzer.instance) {
            TokenAnalyzer.instance = new TokenAnalyzer();
        }
        return TokenAnalyzer.instance;
    }

    recordUsage(
        query: string,
        pattern: TokenUsagePattern
    ): void {
        const patterns = this.patternCache.get(query) || [];
        patterns.push(pattern);

        // Keep only the most recent patterns
        if (patterns.length > this.maxPatternsPerQuery) {
            patterns.shift();
        }

        this.patternCache.set(query, patterns);

        // Update model stats
        this.updateModelStats(pattern);
    }

    private updateModelStats(pattern: TokenUsagePattern): void {
        const stats = this.modelStats.get(pattern.model) || {
            total_tokens: 0,
            success_rate: 0,
            avg_latency: 0,
            patterns: []
        };

        stats.total_tokens += pattern.input_tokens + pattern.output_tokens;
        stats.patterns.push(pattern);

        // Keep only recent patterns for stats
        if (stats.patterns.length > 1000) {
            stats.patterns.shift();
        }

        // Update running averages
        const successfulPatterns = stats.patterns.filter(p => p.success_rate >= this.minSuccessThreshold);
        stats.success_rate = successfulPatterns.length / stats.patterns.length;
        stats.avg_latency = stats.patterns.reduce((sum, p) => sum + p.latency, 0) / stats.patterns.length;

        this.modelStats.set(pattern.model, stats);
    }

    getOptimalParameters(query: string): {
        model: string;
        temperature: number;
        estimated_tokens: number;
    } {
        const patterns = this.patternCache.get(query) || [];
        if (patterns.length === 0) {
            return {
                model: 'claude-3-haiku-20240307', // Default to most efficient model
                temperature: 0.7,
                estimated_tokens: Math.ceil(query.length / 4)
            };
        }

        // Find patterns with high success rates
        const successfulPatterns = patterns.filter(p => p.success_rate >= this.minSuccessThreshold);
        if (successfulPatterns.length === 0) {
            return {
                model: 'claude-3-haiku-20240307',
                temperature: 0.7,
                estimated_tokens: Math.ceil(query.length / 4)
            };
        }

        // Sort by efficiency (lower tokens and latency is better)
        const sortedPatterns = successfulPatterns.sort((a, b) => {
            const aEfficiency = (a.input_tokens + a.output_tokens) * a.latency;
            const bEfficiency = (b.input_tokens + b.output_tokens) * b.latency;
            return aEfficiency - bEfficiency;
        });

        const optimalPattern = sortedPatterns[0];
        return {
            model: optimalPattern.model,
            temperature: optimalPattern.temperature,
            estimated_tokens: optimalPattern.input_tokens + optimalPattern.output_tokens
        };
    }

    getModelStats(): Map<string, ModelStats> {
        return new Map(this.modelStats);
    }

    getTokenUsageStats(): {
        total_tokens: number;
        tokens_per_model: Map<string, number>;
        avg_success_rate: number;
        avg_latency: number;
    } {
        let totalTokens = 0;
        let totalSuccessRate = 0;
        let totalLatency = 0;
        const tokensPerModel = new Map<string, number>();
        let modelCount = 0;

        for (const [model, stats] of this.modelStats) {
            totalTokens += stats.total_tokens;
            totalSuccessRate += stats.success_rate;
            totalLatency += stats.avg_latency;
            tokensPerModel.set(model, stats.total_tokens);
            modelCount++;
        }

        return {
            total_tokens: totalTokens,
            tokens_per_model: tokensPerModel,
            avg_success_rate: modelCount > 0 ? totalSuccessRate / modelCount : 0,
            avg_latency: modelCount > 0 ? totalLatency / modelCount : 0
        };
    }

    optimizePrompt(query: string): string {
        // Remove unnecessary whitespace
        let optimized = query.trim().replace(/\s+/g, ' ');

        // Remove redundant punctuation
        optimized = optimized.replace(/([.,!?])\1+/g, '$1');

        // Truncate if too long (prevent token waste)
        const maxLength = 4096;
        if (optimized.length > maxLength) {
            optimized = optimized.substring(0, maxLength);
        }

        return optimized;
    }

    predictTokenCount(text: string): number {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}

export const tokenAnalyzer = TokenAnalyzer.getInstance();
