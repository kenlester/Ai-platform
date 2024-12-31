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
exports.MetricsCollector = void 0;
const os = __importStar(require("os"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
class MetricsCollector {
    constructor() {
        this.metricsPath = path_1.default.join(process.cwd(), 'data', 'metrics');
        this.errorCounts = new Map();
        this.requestCounts = new Map();
        this.patternHistory = new Map();
        const cpuTimes = os.cpus()[0].times;
        this.lastCpuUsage = {
            user: cpuTimes.user,
            system: cpuTimes.sys,
            idle: cpuTimes.idle
        };
    }
    static getInstance() {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }
    async getSystemMetrics() {
        // Calculate memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
        // Calculate CPU usage
        const cpuTimes = os.cpus()[0].times;
        const currentCpu = {
            user: cpuTimes.user,
            system: cpuTimes.sys,
            idle: cpuTimes.idle
        };
        const userDiff = currentCpu.user - this.lastCpuUsage.user;
        const systemDiff = currentCpu.system - this.lastCpuUsage.system;
        const idleDiff = currentCpu.idle - this.lastCpuUsage.idle;
        const totalDiff = userDiff + systemDiff + idleDiff;
        const cpuUsage = ((userDiff + systemDiff) / totalDiff) * 100;
        // Update CPU usage for next calculation
        this.lastCpuUsage = currentCpu;
        // Calculate error rate
        let totalErrors = 0;
        let totalRequests = 0;
        this.errorCounts.forEach(count => totalErrors += count);
        this.requestCounts.forEach(count => totalRequests += count);
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) : 0;
        return {
            memory_usage: memoryUsage,
            cpu_usage: cpuUsage,
            error_rate: errorRate,
            timestamp: new Date().toISOString()
        };
    }
    async recordSuccess(endpoint, event) {
        const count = this.requestCounts.get(endpoint) || 0;
        this.requestCounts.set(endpoint, count + 1);
        // Record pattern if present
        if (event.pattern) {
            const patterns = this.patternHistory.get(endpoint) || [];
            patterns.push({
                pattern: event.pattern,
                timestamp: new Date().toISOString(),
                success: true,
                metrics: {
                    tokens: event.tokens,
                    latency: Date.now() - event.startTime
                }
            });
            this.patternHistory.set(endpoint, patterns);
        }
        await this.persistMetrics(endpoint, event);
    }
    recordError(endpoint, error) {
        const count = this.errorCounts.get(endpoint) || 0;
        this.errorCounts.set(endpoint, count + 1);
    }
    async getPatternHistory(timeframe = '24h') {
        const patterns = [];
        const now = Date.now();
        const timeframeMs = this.parseTimeframe(timeframe);
        this.patternHistory.forEach((endpointPatterns, endpoint) => {
            const recentPatterns = endpointPatterns.filter(p => {
                const patternTime = new Date(p.timestamp).getTime();
                return (now - patternTime) <= timeframeMs;
            });
            patterns.push(...recentPatterns);
        });
        return patterns;
    }
    parseTimeframe(timeframe) {
        const value = parseInt(timeframe);
        const unit = timeframe.slice(-1);
        switch (unit) {
            case 'h':
                return value * 60 * 60 * 1000;
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            default:
                return 24 * 60 * 60 * 1000; // Default to 24h
        }
    }
    async persistMetrics(endpoint, event) {
        const metricsFile = path_1.default.join(this.metricsPath, `${endpoint}_metrics.json`);
        try {
            const metric = {
                timestamp: new Date().toISOString(),
                tokens: event.tokens,
                latency: Date.now() - event.startTime,
                pattern: event.pattern
            };
            let metrics = [];
            try {
                const content = await fs_1.promises.readFile(metricsFile, 'utf8');
                metrics = JSON.parse(content);
            }
            catch (error) {
                // File doesn't exist or is invalid, start with empty array
            }
            metrics.push(metric);
            // Keep only last 1000 metrics
            if (metrics.length > 1000) {
                metrics = metrics.slice(-1000);
            }
            await fs_1.promises.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
        }
        catch (error) {
            console.error(`Failed to persist metrics for ${endpoint}:`, error);
        }
    }
}
exports.MetricsCollector = MetricsCollector;
//# sourceMappingURL=collector.js.map