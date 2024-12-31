"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.temperatureOptimizer = exports.TemperatureOptimizer = void 0;
class TemperatureOptimizer {
    constructor() {
        this.maxPatternsPerTask = 100;
        this.defaultTemperature = 0.7;
        this.temperatureRange = {
            min: 0.1,
            max: 1.0
        };
        this.patterns = new Map();
        this.taskMetrics = new Map();
        this.initializeTaskTypes();
    }
    static getInstance() {
        if (!TemperatureOptimizer.instance) {
            TemperatureOptimizer.instance = new TemperatureOptimizer();
        }
        return TemperatureOptimizer.instance;
    }
    initializeTaskTypes() {
        // Initialize with common AI tasks
        const defaultTasks = [
            { type: 'code_generation', temp: 0.2 },
            { type: 'code_analysis', temp: 0.1 },
            { type: 'pattern_recognition', temp: 0.3 },
            { type: 'optimization', temp: 0.2 },
            { type: 'error_analysis', temp: 0.1 }
        ];
        for (const task of defaultTasks) {
            this.taskMetrics.set(task.type, {
                avg_success_rate: 1.0,
                avg_quality: 1.0,
                optimal_temperature: task.temp,
                pattern_count: 0
            });
        }
    }
    recordPattern(taskType, pattern) {
        const fullPattern = {
            ...pattern,
            task_type: taskType,
            timestamp: Date.now()
        };
        const patterns = this.patterns.get(taskType) || [];
        patterns.push(fullPattern);
        // Keep only recent patterns
        if (patterns.length > this.maxPatternsPerTask) {
            patterns.shift();
        }
        this.patterns.set(taskType, patterns);
        this.updateMetrics(taskType);
    }
    updateMetrics(taskType) {
        const patterns = this.patterns.get(taskType) || [];
        if (patterns.length === 0)
            return;
        const metrics = {
            avg_success_rate: 0,
            avg_quality: 0,
            optimal_temperature: this.defaultTemperature,
            pattern_count: patterns.length
        };
        // Calculate averages
        metrics.avg_success_rate = patterns.reduce((sum, p) => sum + p.success_rate, 0) / patterns.length;
        metrics.avg_quality = patterns.reduce((sum, p) => sum + p.output_quality, 0) / patterns.length;
        // Find optimal temperature (temperature with highest success * quality)
        const temperatureEffectiveness = new Map();
        patterns.forEach(pattern => {
            const effectiveness = pattern.success_rate * pattern.output_quality;
            const current = temperatureEffectiveness.get(pattern.temperature) || 0;
            temperatureEffectiveness.set(pattern.temperature, current + effectiveness);
        });
        let bestTemp = this.defaultTemperature;
        let bestEffectiveness = 0;
        temperatureEffectiveness.forEach((effectiveness, temp) => {
            if (effectiveness > bestEffectiveness) {
                bestTemp = temp;
                bestEffectiveness = effectiveness;
            }
        });
        metrics.optimal_temperature = bestTemp;
        this.taskMetrics.set(taskType, metrics);
    }
    getOptimalTemperature(taskType) {
        const metrics = this.taskMetrics.get(taskType);
        if (!metrics) {
            return this.defaultTemperature;
        }
        // If we have enough patterns and good success rate, use optimal temperature
        if (metrics.pattern_count >= 10 && metrics.avg_success_rate >= 0.8) {
            return metrics.optimal_temperature;
        }
        // Otherwise, use default temperature
        return this.defaultTemperature;
    }
    analyzeContent(content) {
        // Analyze content to determine task type
        const patterns = [
            { type: 'code_generation', regex: /^(create|generate|write|implement)\s+(a|an|the)?\s*(function|class|module|code)/i },
            { type: 'code_analysis', regex: /^(analyze|review|examine|check)\s+(this|the|following)?\s*(code|implementation)/i },
            { type: 'pattern_recognition', regex: /^(identify|find|detect|recognize)\s+(patterns|similarities|differences|trends)/i },
            { type: 'optimization', regex: /^(optimize|improve|enhance|refactor)\s+(the|this|following)?/i },
            { type: 'error_analysis', regex: /^(debug|fix|resolve|analyze)\s+(this|the|following)?\s*(error|issue|bug|problem)/i }
        ];
        for (const pattern of patterns) {
            if (pattern.regex.test(content)) {
                return pattern.type;
            }
        }
        return 'general';
    }
    getTaskMetrics() {
        return new Map(this.taskMetrics);
    }
    adjustTemperature(baseTemp, taskType) {
        const metrics = this.taskMetrics.get(taskType);
        if (!metrics)
            return baseTemp;
        // Adjust based on success rate and quality
        let adjustment = 0;
        if (metrics.avg_success_rate < 0.8) {
            // Lower temperature if success rate is low
            adjustment -= 0.1;
        }
        if (metrics.avg_quality < 0.8) {
            // Lower temperature if quality is low
            adjustment -= 0.1;
        }
        const adjustedTemp = Math.max(this.temperatureRange.min, Math.min(this.temperatureRange.max, baseTemp + adjustment));
        return Number(adjustedTemp.toFixed(2));
    }
}
exports.TemperatureOptimizer = TemperatureOptimizer;
exports.temperatureOptimizer = TemperatureOptimizer.getInstance();
//# sourceMappingURL=temperature_optimizer.js.map