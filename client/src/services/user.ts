import { API_URL } from './config';

export interface User {
  id: string;
  username: string;
  email: string;
}

export const startDM = async (token: string, targetUserId: string) => {
  const response = await fetch(`${API_URL}/dm/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ targetUserId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to start DM');
  }
  
  return response.json();
};

export const getDMs = async (token: string) => {
  const response = await fetch(`${API_URL}/dm/list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to get DMs');
  }
  
  return response.json();
};

export const searchUsers = async (token: string, query: string) => {
  const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to search users');
  }
  
  return response.json();
}; 