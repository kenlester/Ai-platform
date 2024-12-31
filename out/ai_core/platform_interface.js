"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformInterface = exports.PlatformInterface = void 0;
const handler_1 = require("./protocols/handler");
const crypto_1 = __importDefault(require("crypto"));
class PlatformInterface {
    constructor() {
        this.protocolHandler = handler_1.ProtocolHandler.getInstance();
    }
    static getInstance() {
        if (!PlatformInterface.instance) {
            PlatformInterface.instance = new PlatformInterface();
        }
        return PlatformInterface.instance;
    }
    async processInput(input) {
        const message = {
            protocol_version: "1.0.0",
            message_id: crypto_1.default.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            sender: {
                id: "platform_interface",
                type: "service",
                capabilities: ["pattern_recognition", "task_execution", "learning"]
            },
            intent: {
                type: "query",
                action: "process_input",
                priority: 2
            },
            content: {
                format: "json",
                data: input,
                encoding: "none"
            },
            optimization: {
                compression: false,
                caching: {
                    ttl: 3600,
                    strategy: "memory"
                }
            }
        };
        return await this.protocolHandler.handleMessage(message);
    }
    async streamOutput(output) {
        // Stream in AI-optimized format
        process.stdout.write(JSON.stringify({
            timestamp: output.timestamp,
            message_id: output.message_id,
            content: output.content,
            metrics: output.metrics
        }));
    }
}
exports.PlatformInterface = PlatformInterface;
// Export singleton instance
exports.platformInterface = PlatformInterface.getInstance();
// Handle input stream with proper typing
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
    try {
        const input = JSON.parse(data);
        const response = await exports.platformInterface.processInput(input);
        await exports.platformInterface.streamOutput(response);
    }
    catch (error) {
        const errorMessage = {
            protocol_version: "1.0.0",
            message_id: crypto_1.default.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            sender: {
                id: "platform_interface",
                type: "service",
                capabilities: ["error_handling"]
            },
            intent: {
                type: "error",
                action: "error_response"
            },
            content: {
                format: "json",
                data: {
                    error: error.message || 'Unknown error occurred',
                    timestamp: new Date().toISOString()
                }
            }
        };
        process.stderr.write(JSON.stringify(errorMessage));
    }
});
// Handle process termination with cleanup
process.on('SIGINT', async () => {
    const terminationMessage = {
        protocol_version: "1.0.0",
        message_id: crypto_1.default.randomBytes(16).toString('hex'),
        timestamp: new Date().toISOString(),
        sender: {
            id: "platform_interface",
            type: "service",
            capabilities: ["system_control"]
        },
        intent: {
            type: "notification",
            action: "shutdown"
        },
        content: {
            format: "json",
            data: {
                status: "shutting_down",
                timestamp: new Date().toISOString()
            }
        }
    };
    await exports.platformInterface.streamOutput(terminationMessage);
    process.exit(0);
});
//# sourceMappingURL=platform_interface.js.map