import { API_URL } from '../services/config';

export async function addReaction(token: string, messageId: string, emoji: string) {
  const response = await fetch(`${API_URL}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ emoji })
  });

  if (!response.ok) {
    throw new Error('Failed to toggle reaction');
  }
  return response.json();
} 