import { API_URL } from "./config";

export const toggleAIEnabled = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/ai/ai-toggle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to toggle AI setting");
    }

    const data = await response.json();
    return data.aiEnabled;
  } catch (error) {
    console.error("Error toggling AI setting:", error);
    throw error;
  }
};

export const getAIEnabled = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/ai/ai-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get AI status");
    }

    const data = await response.json();
    return data.aiEnabled;
  } catch (error) {
    console.error("Error getting AI status:", error);
    throw error;
  }
};
