"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenAnalyzer = exports.TokenAnalyzer = void 0;
const lru_cache_1 = require("lru-cache");
class TokenAnalyzer {
    constructor() {
        this.maxPatternsPerQuery = 100;
        this.minSuccessThreshold = 0.85;
        this.patternCache = new lru_cache_1.LRUCache({
            max: 1000,
            ttl: 24 * 60 * 60 * 1000 // 24 hour TTL
        });
        this.modelStats = new Map();
    }
    static getInstance() {
        if (!TokenAnalyzer.instance) {
            TokenAnalyzer.instance = new TokenAnalyzer();
        }
        return TokenAnalyzer.instance;
    }
    recordUsage(query, pattern) {
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
    updateModelStats(pattern) {
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
    getOptimalParameters(query) {
        const patterns = this.patternCache.get(query) || [];
        if (patterns.length === 0) {
            return {
                model: 'claude-3-haiku-20240307',
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
    getModelStats() {
        return new Map(this.modelStats);
    }
    getTokenUsageStats() {
        let totalTokens = 0;
        let totalSuccessRate = 0;
        let totalLatency = 0;
        const tokensPerModel = new Map();
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
    optimizePrompt(query) {
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
    predictTokenCount(text) {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}
exports.TokenAnalyzer = TokenAnalyzer;
exports.tokenAnalyzer = TokenAnalyzer.getInstance();
//# sourceMappingURL=token_analyzer.js.map