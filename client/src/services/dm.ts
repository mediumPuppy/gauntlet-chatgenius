import { API_URL } from "../services/config";

interface DM {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: string;
  other_user_id: string;
}

export async function getDMById(token: string, dmId: string): Promise<DM> {
  const response = await fetch(`${API_URL}/dm/${dmId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch DM");
  }

  return response.json();
}
