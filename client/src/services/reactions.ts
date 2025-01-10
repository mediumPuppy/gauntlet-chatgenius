import { API_URL } from '../services/config';

export async function toggleReaction(token: string, messageId: string, emoji: string) {
  console.log('4. toggleReaction service called with:', { messageId, emoji });
  const response = await fetch(`${API_URL}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ emoji })
  });

  console.log('5. Got response:', response.status);
  if (!response.ok) {
    throw new Error('Failed to toggle reaction');
  }
  const data = await response.json();
  console.log('6. Response data:', data);
  return data;
} 