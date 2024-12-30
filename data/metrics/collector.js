"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollector = void 0;
class MetricsCollector {
    constructor() {
        this.settings = {
            retentionDays: 30,
            alertThresholds: {
                tokens_per_minute: 80000,
                error_rate: 0.05
            }
        };
        this.metrics = new Map();
    }
    async updateSettings(settings) {
        this.settings = {
            ...this.settings,
            ...settings,
            alertThresholds: {
                ...this.settings.alertThresholds,
                ...settings.alertThresholds
            }
        };
    }
    async recordSuccess(endpoint, data) {
        const metrics = this.metrics.get(endpoint) || [];
        metrics.push({
            ...data,
            timestamp: new Date().toISOString(),
            success: true
        });
        this.metrics.set(endpoint, this.pruneOldMetrics(metrics));
    }
    async recordError(endpoint, error) {
        const metrics = this.metrics.get(endpoint) || [];
        metrics.push({
            timestamp: new Date().toISOString(),
            error: error.message,
            success: false
        });
        this.metrics.set(endpoint, this.pruneOldMetrics(metrics));
    }
    async getStats() {
        const stats = {
            endpoints: {},
            total_requests: 0,
            total_errors: 0,
            total_tokens: 0
        };
        this.metrics.forEach((metrics, endpoint) => {
            const endpointStats = {
                requests: metrics.length,
                errors: metrics.filter(m => !m.success).length,
                tokens: metrics.reduce((sum, m) => sum + (m.tokens || 0), 0)
            };
            stats.endpoints[endpoint] = endpointStats;
            stats.total_requests += endpointStats.requests;
            stats.total_errors += endpointStats.errors;
            stats.total_tokens += endpointStats.tokens;
        });
        return stats;
    }
    isHealthy() {
        const stats = this.getErrorRate();
        return stats.errorRate <= (this.settings.alertThresholds.error_rate || 0.05);
    }
    getErrorRate() {
        let total = 0;
        let errors = 0;
        this.metrics.forEach(metrics => {
            total += metrics.length;
            errors += metrics.filter(m => !m.success).length;
        });
        return {
            total,
            errors,
            errorRate: total === 0 ? 0 : errors / total
        };
    }
    pruneOldMetrics(metrics) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.settings.retentionDays);
        return metrics.filter(m => new Date(m.timestamp) > cutoff);
    }
}
exports.MetricsCollector = MetricsCollector;
