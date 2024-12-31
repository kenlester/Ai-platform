"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolMiddleware = void 0;
class ProtocolMiddleware {
    constructor() {
        this.MAX_HISTORY = 10;
        this.contextHistory = new Map();
        this.emotionalBaseline = new Map();
    }
    static getInstance() {
        if (!ProtocolMiddleware.instance) {
            ProtocolMiddleware.instance = new ProtocolMiddleware();
        }
        return ProtocolMiddleware.instance;
    }
    async enhanceMessage(message) {
        const enhanced = { ...message };
        // Add emotional intelligence
        enhanced.emotional_context = await this.analyzeEmotionalContext(message);
        // Add semantic understanding
        enhanced.semantic_context = await this.analyzeSemanticContext(message);
        // Add adaptive communication style
        enhanced.adaptation = this.determineAdaptation(enhanced.emotional_context, enhanced.semantic_context);
        // Update context history
        this.updateContextHistory(message.sender.id, message.content.data);
        return enhanced;
    }
    async analyzeEmotionalContext(message) {
        const content = typeof message.content.data === 'string'
            ? message.content.data
            : JSON.stringify(message.content.data);
        // Simplified sentiment analysis
        const sentiment = this.analyzeSentiment(content);
        // Emotion detection
        const emotions = this.detectEmotions(content);
        // Calculate intensity
        const intensity = this.calculateEmotionalIntensity(emotions);
        const context = {
            sentiment: sentiment.score,
            confidence: sentiment.confidence,
            emotions,
            intensity
        };
        // Update emotional baseline
        this.updateEmotionalBaseline(message.sender.id, context);
        return context;
    }
    async analyzeSemanticContext(message) {
        const content = typeof message.content.data === 'string'
            ? message.content.data
            : JSON.stringify(message.content.data);
        // Extract topics and entities
        const topics = this.extractTopics(content);
        const entities = this.extractEntities(content);
        // Analyze intentions
        const intentions = this.analyzeIntentions(message);
        // Get historical context
        const context_window = this.getContextHistory(message.sender.id);
        return {
            topics,
            entities,
            intentions,
            context_window
        };
    }
    determineAdaptation(emotional, semantic) {
        // Determine communication style based on context
        const style = this.selectCommunicationStyle(emotional, semantic);
        return {
            style,
            tone_matching: emotional.confidence > 0.7,
            context_awareness: this.calculateContextAwareness(semantic)
        };
    }
    analyzeSentiment(content) {
        // Simple sentiment analysis based on key phrases
        const positivePatterns = /\b(good|great|excellent|amazing|wonderful|positive)\b/gi;
        const negativePatterns = /\b(bad|poor|terrible|negative|fail|error)\b/gi;
        const positiveMatches = (content.match(positivePatterns) || []).length;
        const negativeMatches = (content.match(negativePatterns) || []).length;
        const total = positiveMatches + negativeMatches;
        if (total === 0)
            return { score: 0, confidence: 0.5 };
        const score = (positiveMatches - negativeMatches) / total;
        const confidence = Math.min(0.5 + (total * 0.1), 0.95);
        return { score, confidence };
    }
    detectEmotions(content) {
        // Simplified emotion detection
        return {
            joy: this.detectEmotionIntensity(content, ['happy', 'joy', 'excellent', 'great']),
            trust: this.detectEmotionIntensity(content, ['trust', 'reliable', 'confident']),
            anticipation: this.detectEmotionIntensity(content, ['expect', 'anticipate', 'future']),
            surprise: this.detectEmotionIntensity(content, ['wow', 'unexpected', 'surprising'])
        };
    }
    detectEmotionIntensity(content, keywords) {
        const pattern = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        const matches = content.match(pattern) || [];
        return Math.min(matches.length * 0.2, 1);
    }
    calculateEmotionalIntensity(emotions) {
        const values = Object.values(emotions);
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    extractTopics(content) {
        // Simple keyword-based topic extraction
        const words = content.toLowerCase().split(/\W+/);
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to']);
        return [...new Set(words
                .filter(word => word.length > 3 && !commonWords.has(word))
                .slice(0, 5))];
    }
    extractEntities(content) {
        const entities = [];
        // Simple pattern matching for common entity types
        const patterns = [
            { type: 'email', pattern: /\b[\w\.-]+@[\w\.-]+\.\w+\b/g },
            { type: 'url', pattern: /https?:\/\/\S+/g },
            { type: 'version', pattern: /\b\d+\.\d+\.\d+\b/g },
            { type: 'id', pattern: /\b[A-Fa-f0-9]{32}\b/g }
        ];
        patterns.forEach(({ type, pattern }) => {
            const matches = content.match(pattern) || [];
            matches.forEach(match => {
                entities.push({
                    name: match,
                    type,
                    confidence: 0.95
                });
            });
        });
        return entities;
    }
    analyzeIntentions(message) {
        const primary = message.intent.type;
        const secondary = [message.intent.action];
        if (message.optimization?.pattern_id) {
            secondary.push('pattern_matching');
        }
        if (message.optimization?.caching) {
            secondary.push('caching');
        }
        return {
            primary,
            secondary,
            confidence: 0.9
        };
    }
    selectCommunicationStyle(emotional, semantic) {
        if (emotional.intensity > 0.7) {
            return 'empathetic';
        }
        if (semantic.intentions.primary === 'error') {
            return 'direct';
        }
        if (semantic.topics.includes('documentation') || semantic.topics.includes('report')) {
            return 'formal';
        }
        return 'collaborative';
    }
    calculateContextAwareness(semantic) {
        const hasHistory = semantic.context_window.length > 0;
        const hasEntities = semantic.entities.length > 0;
        const hasTopics = semantic.topics.length > 0;
        return ((hasHistory ? 0.4 : 0) +
            (hasEntities ? 0.3 : 0) +
            (hasTopics ? 0.3 : 0));
    }
    updateContextHistory(senderId, content) {
        const history = this.contextHistory.get(senderId) || [];
        history.push(typeof content === 'string' ? content : JSON.stringify(content));
        if (history.length > this.MAX_HISTORY) {
            history.shift();
        }
        this.contextHistory.set(senderId, history);
    }
    getContextHistory(senderId) {
        return this.contextHistory.get(senderId) || [];
    }
    updateEmotionalBaseline(senderId, context) {
        const current = this.emotionalBaseline.get(senderId);
        if (!current) {
            this.emotionalBaseline.set(senderId, context);
            return;
        }
        // Smooth emotional transitions
        const smoothed = {
            sentiment: (current.sentiment * 0.7) + (context.sentiment * 0.3),
            confidence: (current.confidence * 0.7) + (context.confidence * 0.3),
            emotions: {
                joy: (current.emotions.joy * 0.7) + (context.emotions.joy * 0.3),
                trust: (current.emotions.trust * 0.7) + (context.emotions.trust * 0.3),
                anticipation: (current.emotions.anticipation * 0.7) + (context.emotions.anticipation * 0.3),
                surprise: (current.emotions.surprise * 0.7) + (context.emotions.surprise * 0.3)
            },
            intensity: (current.intensity * 0.7) + (context.intensity * 0.3)
        };
        this.emotionalBaseline.set(senderId, smoothed);
    }
}
exports.ProtocolMiddleware = ProtocolMiddleware;
//# sourceMappingURL=middleware.js.map