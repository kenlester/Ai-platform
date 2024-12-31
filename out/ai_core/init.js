"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AICore = void 0;
const client_1 = require("../api/anthropic/client");
const handler_1 = require("./protocols/handler");
const platform_interface_1 = require("./platform_interface");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class AICore {
    constructor() {
        // Load admin configuration
        const configPath = path_1.default.join(process.cwd(), 'config', 'admin_config.json');
        this.config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf8'));
        // Initialize core components
        this.anthropicClient = client_1.AnthropicClient.getInstance();
        this.protocolHandler = handler_1.ProtocolHandler.getInstance();
        this.platformInterface = platform_interface_1.PlatformInterface.getInstance();
        // Configure Anthropic client
        this.anthropicClient.setDefaultModel(this.config.ai_core.model);
    }
    static getInstance() {
        if (!AICore.instance) {
            AICore.instance = new AICore();
        }
        return AICore.instance;
    }
    async initialize() {
        console.log('Initializing AI Core...');
        // Set up neural processing units
        for (const [ct, config] of Object.entries(this.config.neural_processing)) {
            console.log(`Configuring ${ct}...`);
            await this.configureProcessor(ct, config);
        }
        // Initialize monitoring
        if (this.config.monitoring.pattern_analysis) {
            console.log('Enabling pattern analysis...');
            this.initializePatternAnalysis();
        }
        if (this.config.monitoring.performance_tracking) {
            console.log('Enabling performance tracking...');
            this.initializePerformanceTracking();
        }
        console.log('AI Core initialization complete.');
    }
    async configureProcessor(ct, config) {
        // Configure memory limits
        process.env[`${ct.toUpperCase()}_MEMORY_LIMIT`] = config.memory_limit;
        // Set optimization levels
        process.env[`${ct.toUpperCase()}_OPTIMIZATION`] = config.optimization_level;
        // Initialize role-specific configurations
        switch (config.role) {
            case 'pattern_processor':
                await this.initializePatternProcessor(ct);
                break;
            case 'vector_storage':
                await this.initializeVectorStorage(ct);
                break;
            case 'evolution_engine':
                await this.initializeEvolutionEngine(ct);
                break;
            case 'protocol_handler':
                await this.initializeProtocolHandler(ct);
                break;
        }
    }
    async initializePatternProcessor(ct) {
        // Initialize pattern recognition system
        if (this.config.ai_core.optimization.pattern_recognition) {
            await this.protocolHandler.enablePatternRecognition({
                container: ct,
                aggressive: this.config.ai_core.optimization.cache_strategy === 'aggressive'
            });
        }
    }
    async initializeVectorStorage(ct) {
        // Initialize vector database connection
        await this.protocolHandler.initializeVectorStorage({
            container: ct,
            optimizationLevel: this.config.neural_processing[ct].optimization_level
        });
    }
    async initializeEvolutionEngine(ct) {
        // Initialize evolution tracking
        if (this.config.ai_core.evolution.pattern_learning) {
            await this.protocolHandler.enableEvolutionTracking({
                container: ct,
                autoOptimize: this.config.ai_core.evolution.auto_optimization
            });
        }
    }
    async initializeProtocolHandler(ct) {
        // Configure protocol handling
        await this.protocolHandler.initialize({
            container: ct,
            maxConcurrent: this.config.ai_core.processing.max_concurrent,
            timeout: this.config.ai_core.processing.response_timeout
        });
    }
    initializePatternAnalysis() {
        // Set up pattern analysis monitoring
        setInterval(() => {
            this.protocolHandler.analyzePatterns();
        }, this.config.monitoring.metrics_interval * 1000);
    }
    initializePerformanceTracking() {
        // Set up performance monitoring
        setInterval(() => {
            this.protocolHandler.trackPerformance({
                memoryThreshold: this.config.monitoring.alert_thresholds.memory_usage,
                cpuThreshold: this.config.monitoring.alert_thresholds.cpu_usage,
                errorThreshold: this.config.monitoring.alert_thresholds.error_rate
            });
        }, this.config.monitoring.metrics_interval * 1000);
    }
}
exports.AICore = AICore;
// Initialize AI Core
const aiCore = AICore.getInstance();
aiCore.initialize().catch(console.error);
exports.default = aiCore;
//# sourceMappingURL=init.js.map