interface PromptTemplate {
    task_type: string;
    template: string;
    variables: string[];
    success_rate: number;
    token_efficiency: number;
    response_quality: number;
    timestamp: number;
}

interface TemplateMetrics {
    avg_success_rate: number;
    avg_token_efficiency: number;
    avg_response_quality: number;
    usage_count: number;
}

export class PromptOptimizer {
    private static instance: PromptOptimizer;
    private templates: Map<string, PromptTemplate[]>;
    private metrics: Map<string, TemplateMetrics>;
    private readonly maxTemplatesPerType = 50;

    private constructor() {
        this.templates = new Map();
        this.metrics = new Map();
        this.initializeTemplates();
    }

    static getInstance(): PromptOptimizer {
        if (!PromptOptimizer.instance) {
            PromptOptimizer.instance = new PromptOptimizer();
        }
        return PromptOptimizer.instance;
    }

    private initializeTemplates(): void {
        // Initialize with optimized templates for common tasks
        const defaultTemplates = [
            {
                task_type: 'code_generation',
                template: 'Generate a {language} {type} that {functionality}. Requirements:\n{requirements}\nConstraints:\n{constraints}',
                variables: ['language', 'type', 'functionality', 'requirements', 'constraints']
            },
            {
                task_type: 'code_analysis',
                template: 'Analyze the following {language} code for {aspect}:\n```{language}\n{code}\n```\nFocus on:\n{focus_points}',
                variables: ['language', 'aspect', 'code', 'focus_points']
            },
            {
                task_type: 'pattern_recognition',
                template: 'Identify {pattern_type} patterns in the following {data_type}:\n{data}\nConsider:\n{considerations}',
                variables: ['pattern_type', 'data_type', 'data', 'considerations']
            },
            {
                task_type: 'optimization',
                template: 'Optimize the following {target_type} for {optimization_goal}:\n{content}\nConstraints:\n{constraints}',
                variables: ['target_type', 'optimization_goal', 'content', 'constraints']
            },
            {
                task_type: 'error_analysis',
                template: 'Analyze the following error in {context}:\nError:\n{error}\nEnvironment:\n{environment}\nRecent changes:\n{changes}',
                variables: ['context', 'error', 'environment', 'changes']
            }
        ];

        for (const template of defaultTemplates) {
            this.templates.set(template.task_type, [{
                ...template,
                success_rate: 1.0,
                token_efficiency: 1.0,
                response_quality: 1.0,
                timestamp: Date.now()
            }]);

            this.metrics.set(template.task_type, {
                avg_success_rate: 1.0,
                avg_token_efficiency: 1.0,
                avg_response_quality: 1.0,
                usage_count: 0
            });
        }
    }

    recordTemplateUsage(
        taskType: string,
        template: string,
        variables: string[],
        metrics: {
            success_rate: number;
            token_efficiency: number;
            response_quality: number;
        }
    ): void {
        const templates = this.templates.get(taskType) || [];
        const newTemplate: PromptTemplate = {
            task_type: taskType,
            template,
            variables,
            success_rate: metrics.success_rate,
            token_efficiency: metrics.token_efficiency,
            response_quality: metrics.response_quality,
            timestamp: Date.now()
        };

        templates.push(newTemplate);

        // Keep only recent templates
        if (templates.length > this.maxTemplatesPerType) {
            templates.shift();
        }

        this.templates.set(taskType, templates);
        this.updateMetrics(taskType);
    }

    private updateMetrics(taskType: string): void {
        const templates = this.templates.get(taskType) || [];
        if (templates.length === 0) return;

        const metrics = {
            avg_success_rate: 0,
            avg_token_efficiency: 0,
            avg_response_quality: 0,
            usage_count: templates.length
        };

        // Calculate averages
        metrics.avg_success_rate = templates.reduce((sum, t) => sum + t.success_rate, 0) / templates.length;
        metrics.avg_token_efficiency = templates.reduce((sum, t) => sum + t.token_efficiency, 0) / templates.length;
        metrics.avg_response_quality = templates.reduce((sum, t) => sum + t.response_quality, 0) / templates.length;

        this.metrics.set(taskType, metrics);
    }

    getOptimalTemplate(taskType: string): {
        template: string;
        variables: string[];
    } {
        const templates = this.templates.get(taskType);
        if (!templates || templates.length === 0) {
            throw new Error(`No template found for task type: ${taskType}`);
        }

        // Sort by effectiveness (weighted average of metrics)
        const sortedTemplates = [...templates].sort((a, b) => {
            const aScore = (a.success_rate * 0.4) + (a.token_efficiency * 0.3) + (a.response_quality * 0.3);
            const bScore = (b.success_rate * 0.4) + (b.token_efficiency * 0.3) + (b.response_quality * 0.3);
            return bScore - aScore;
        });

        return {
            template: sortedTemplates[0].template,
            variables: sortedTemplates[0].variables
        };
    }

    formatPrompt(template: string, variables: Record<string, string>): string {
        let prompt = template;
        for (const [key, value] of Object.entries(variables)) {
            prompt = prompt.replace(`{${key}}`, value);
        }
        return prompt;
    }

    analyzePromptEfficiency(prompt: string): number {
        // Calculate token efficiency score (0-1)
        let efficiency = 1.0;

        // Penalize very long prompts
        if (prompt.length > 1000) efficiency *= 0.9;
        if (prompt.length > 2000) efficiency *= 0.8;

        // Penalize redundant whitespace
        const whitespaceRatio = (prompt.match(/\s+/g) || []).length / prompt.length;
        if (whitespaceRatio > 0.2) efficiency *= 0.9;

        // Penalize redundant punctuation
        const redundantPunctuation = (prompt.match(/([.,!?])\1+/g) || []).length;
        if (redundantPunctuation > 0) efficiency *= 0.95;

        // Bonus for structured format (e.g., bullet points, numbered lists)
        if (prompt.match(/(\n[-*]\s|\n\d+\.\s)/g)) efficiency *= 1.1;

        return Math.min(1.0, Math.max(0.1, efficiency));
    }

    getTemplateMetrics(): Map<string, TemplateMetrics> {
        return new Map(this.metrics);
    }

    optimizePrompt(prompt: string): string {
        // Remove redundant whitespace
        let optimized = prompt.trim().replace(/\s+/g, ' ');

        // Ensure proper spacing around code blocks
        optimized = optimized.replace(/```(\w+)?\n/g, '\n```$1\n');
        optimized = optimized.replace(/\n```/g, '\n```\n');

        // Format lists consistently
        optimized = optimized.replace(/^\s*[-*]\s*/gm, '- ');
        optimized = optimized.replace(/^\s*(\d+)\.\s*/gm, '$1. ');

        // Ensure proper line breaks
        optimized = optimized.replace(/([.!?])\s+/g, '$1\n');

        return optimized;
    }
}

export const promptOptimizer = PromptOptimizer.getInstance();
