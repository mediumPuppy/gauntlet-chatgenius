import { Message } from "../types/message";
import { API_URL } from "./config";

export const triggerAIResponse = async (
  mentionedUsername: string,
  triggeringMessage: Message,
  recentMessages: Message[],
  token: string,
) => {
  try {
    const response = await fetch(`${API_URL}/ai/generate-response`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mentionedUsername,
        triggeringMessage,
        recentMessages: recentMessages.slice(-10), // Last 10 messages for context
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate AI response");
    }
  } catch (error) {
    console.error("Error triggering AI response:", error);
  }
};

interface BotQueryParams {
  content: string;
  channelId?: string;
  workspaceId?: string;
}

export const handleBotQuery = async (
  token: string,
  params: BotQueryParams
) => {
  try {
    console.log('Sending bot query:', params);

    const response = await fetch(`${API_URL}/ai/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to process bot query");
    }

    return response.json();
  } catch (error) {
    console.error("Error processing bot query:", error);
    throw error;
  }
};
