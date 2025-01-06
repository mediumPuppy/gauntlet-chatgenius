const API_URL = 'http://localhost:3000/api';

export interface Message {
  id: string;
  content: string;
  channel_id: string;
  user_id: string;
  username: string;
  created_at: string;
}

export async function getMessages(token: string, channelId: string): Promise<Message[]> {
  const response = await fetch(`${API_URL}/channels/${channelId}/messages`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch messages');
  }

  return response.json();
}

export async function sendMessage(token: string, channelId: string, content: string): Promise<Message> {
  const response = await fetch(`${API_URL}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send message');
  }

  return response.json();
} 