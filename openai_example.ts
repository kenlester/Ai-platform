import OpenAI from 'openai';

class OpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async generateText(prompt: string, model: string = 'gpt-3.5-turbo', maxTokens: number = 1000): Promise<string | null> {
    try {
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred');
    }
  }

  async analyzeCode(code: string, language: string, analysisType: 'security' | 'performance' | 'style' | 'bugs'): Promise<string | null> {
    try {
      const prompt = `Analyze this ${language} code for ${analysisType} issues:\n\n${code}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred');
    }
  }
}

// Example usage
async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  const openAIService = new OpenAIService(apiKey);

  // Example 1: Generate text
  try {
    console.log('Generating text...');
    const story = await openAIService.generateText(
      'Write a short story about a robot learning to paint',
      'gpt-3.5-turbo',
      500
    );
    console.log('\nGenerated Story:');
    console.log(story);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Text generation error:', error.message);
    } else {
      console.error('An unknown error occurred during text generation');
    }
  }

  // Example 2: Analyze code
  try {
    console.log('\nAnalyzing code...');
    const code = `
      function fetchUserData(userId) {
        return fetch('api/users/' + userId)
          .then(response => response.json())
          .catch(error => console.log(error));
      }
    `;

    const analysis = await openAIService.analyzeCode(
      code,
      'javascript',
      'security'
    );
    console.log('\nCode Analysis:');
    console.log(analysis);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Code analysis error:', error.message);
    } else {
      console.error('An unknown error occurred during code analysis');
    }
  }
}

main().catch(console.error);
