import { Message } from '../types/message';
import { API_URL } from './config';

export const triggerAIResponse = async (
  mentionedUsername: string,
  triggeringMessage: Message,
  recentMessages: Message[],
  token: string
) => {
  try {
    const response = await fetch(`${API_URL}/ai/generate-response`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mentionedUsername,
        triggeringMessage,
        recentMessages: recentMessages.slice(-10) // Last 10 messages for context
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate AI response');
    }
  } catch (error) {
    console.error('Error triggering AI response:', error);
  }
}; 