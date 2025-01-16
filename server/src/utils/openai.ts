import { OpenAI } from "openai";

// Wrap OpenAI client with any necessary configuration or error handling
export function wrapOpenAI(client: OpenAI): OpenAI {
  // Add any custom configuration or error handling here
  return client;
}

// Create a new OpenAI client with environment variables
export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} 