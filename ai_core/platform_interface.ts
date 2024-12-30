import { ProtocolHandler, ProtocolMessage } from './protocols/handler';
import crypto from 'crypto';

export class PlatformInterface {
    private static instance: PlatformInterface;
    private protocolHandler: ProtocolHandler;

    private constructor() {
        this.protocolHandler = ProtocolHandler.getInstance();
    }

    static getInstance(): PlatformInterface {
        if (!PlatformInterface.instance) {
            PlatformInterface.instance = new PlatformInterface();
        }
        return PlatformInterface.instance;
    }

    async processInput(input: any): Promise<ProtocolMessage> {
        const message: ProtocolMessage = {
            protocol_version: "1.0.0",
            message_id: crypto.randomBytes(16).toString('hex'),
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

    async streamOutput(output: ProtocolMessage): Promise<void> {
        // Stream in AI-optimized format
        process.stdout.write(JSON.stringify({
            timestamp: output.timestamp,
            message_id: output.message_id,
            content: output.content,
            metrics: output.metrics
        }));
    }
}

// Export singleton instance
export const platformInterface = PlatformInterface.getInstance();

// Handle input stream with proper typing
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data: string) => {
    try {
        const input = JSON.parse(data);
        const response = await platformInterface.processInput(input);
        await platformInterface.streamOutput(response);
    } catch (error: any) {
        const errorMessage: ProtocolMessage = {
            protocol_version: "1.0.0",
            message_id: crypto.randomBytes(16).toString('hex'),
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
    const terminationMessage: ProtocolMessage = {
        protocol_version: "1.0.0",
        message_id: crypto.randomBytes(16).toString('hex'),
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
    await platformInterface.streamOutput(terminationMessage);
    process.exit(0);
});
