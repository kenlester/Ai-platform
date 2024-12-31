import * as os from 'os';
import { promises as fs } from 'fs';
import path from 'path';

interface SystemMetrics {
    memory_usage: number;
    cpu_usage: number;
    error_rate: number;
    timestamp: string;
}

interface MetricEvent {
    startTime: number;
    tokens: number;
    endpoint: string;
    pattern: string | null;
}

export class MetricsCollector {
    private static instance: MetricsCollector;
    private metricsPath: string;
    private errorCounts: Map<string, number>;
    private requestCounts: Map<string, number>;
    private lastCpuUsage: { user: number; system: number; idle: number };
    private patternHistory: Map<string, any[]>;

    constructor() {
        this.metricsPath = path.join(process.cwd(), 'data', 'metrics');
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

    static getInstance(): MetricsCollector {
        if (!MetricsCollector.instance) {
            MetricsCollector.instance = new MetricsCollector();
        }
        return MetricsCollector.instance;
    }

    async getSystemMetrics(): Promise<SystemMetrics> {
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

    async recordSuccess(endpoint: string, event: MetricEvent): Promise<void> {
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

    recordError(endpoint: string, error: Error): void {
        const count = this.errorCounts.get(endpoint) || 0;
        this.errorCounts.set(endpoint, count + 1);
    }

    async getPatternHistory(timeframe: string = '24h'): Promise<any[]> {
        const patterns: any[] = [];
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

    private parseTimeframe(timeframe: string): number {
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

    private async persistMetrics(endpoint: string, event: MetricEvent): Promise<void> {
        const metricsFile = path.join(this.metricsPath, `${endpoint}_metrics.json`);
        
        try {
            const metric = {
                timestamp: new Date().toISOString(),
                tokens: event.tokens,
                latency: Date.now() - event.startTime,
                pattern: event.pattern
            };

            let metrics = [];
            try {
                const content = await fs.readFile(metricsFile, 'utf8');
                metrics = JSON.parse(content);
            } catch (error) {
                // File doesn't exist or is invalid, start with empty array
            }

            metrics.push(metric);

            // Keep only last 1000 metrics
            if (metrics.length > 1000) {
                metrics = metrics.slice(-1000);
            }

            await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
        } catch (error) {
            console.error(`Failed to persist metrics for ${endpoint}:`, error);
        }
    }
}
