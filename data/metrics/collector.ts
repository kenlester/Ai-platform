export interface MetricsSettings {
  retentionDays: number;
  alertThresholds: {
    tokens_per_minute?: number;
    cost_per_hour?: number;
    error_rate?: number;
  };
}

export interface MetricData {
  startTime: number;
  tokens: number;
  endpoint: string;
  pattern: string | null;
  settings?: any;
}

export class MetricsCollector {
  private settings: MetricsSettings;
  private metrics: Map<string, any[]>;

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

  async updateSettings(settings: Partial<MetricsSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...settings,
      alertThresholds: {
        ...this.settings.alertThresholds,
        ...settings.alertThresholds
      }
    };
  }

  async recordSuccess(endpoint: string, data: MetricData): Promise<void> {
    const metrics = this.metrics.get(endpoint) || [];
    metrics.push({
      ...data,
      timestamp: new Date().toISOString(),
      success: true
    });
    this.metrics.set(endpoint, this.pruneOldMetrics(metrics));
  }

  async recordError(endpoint: string, error: Error): Promise<void> {
    const metrics = this.metrics.get(endpoint) || [];
    metrics.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      success: false
    });
    this.metrics.set(endpoint, this.pruneOldMetrics(metrics));
  }

  async getStats(): Promise<any> {
    const stats: any = {
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

  isHealthy(): boolean {
    const stats = this.getErrorRate();
    return stats.errorRate <= (this.settings.alertThresholds.error_rate || 0.05);
  }

  private getErrorRate(): { total: number; errors: number; errorRate: number } {
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

  private pruneOldMetrics(metrics: any[]): any[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.settings.retentionDays);
    return metrics.filter(m => new Date(m.timestamp) > cutoff);
  }
}
