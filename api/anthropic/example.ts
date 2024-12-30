import { anthropicClient } from './client';
import { MessageRequest } from './types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function example() {
    try {
        // Single message example
        const response = await anthropicClient.createMessage({
            messages: [{
                role: 'user' as const,
                content: 'What is the capital of France? Please keep the answer brief.'
            }],
            max_tokens: 100
        });
        console.log('Single message response:', response.content[0].text);

        // Batch processing example
        const batchMessages: MessageRequest[] = [
            {
                messages: [{
                    role: 'user' as const,
                    content: 'What is 2+2? One word answer.'
                }]
            },
            {
                messages: [{
                    role: 'user' as const,
                    content: 'What color is the sky? One word answer.'
                }]
            },
            {
                messages: [{
                    role: 'user' as const,
                    content: 'What is the first month of the year? One word answer.'
                }]
            }
        ];

        console.log('Processing batch messages...');
        const batchResponses = await anthropicClient.processBatch(batchMessages, {
            batchSize: 2,
            delayBetweenBatches: 2000
        });

        console.log('Batch responses:');
        batchResponses.forEach((response, index) => {
            console.log(`${index + 1}. ${response.content[0].text}`);
        });

        // Check rate limit status
        const status = anthropicClient.getRateLimitStatus();
        console.log('\nRate limit status:', status);

    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
            
            // Check if it's a rate limit error
            if (error.message.includes('rate limit')) {
                const status = anthropicClient.getRateLimitStatus();
                console.log('Current rate limit status:', status);
                console.log('Please wait before making more requests.');
            }
            
            // Check if it's a credit balance error
            if (error.message.includes('credit balance')) {
                console.log('Please add credits to your Anthropic account to continue.');
            }
        } else {
            console.error('Unknown error:', error);
        }
    }
}

// Run the example
example().catch(console.error);

/* Example output:
Single message response: Paris is the capital of France.

Batch responses:
1. Four
2. Blue
3. January

Rate limit status: {
    tokensRemaining: 75000,
    queueLength: 0
}
*/
