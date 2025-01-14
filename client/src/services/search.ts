import { API_URL } from "./config";

export async function searchMessages(token: string, query: string) {
  const response = await fetch(
    `${API_URL}/search/messages?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to search messages");
  }

  return response.json();
}
