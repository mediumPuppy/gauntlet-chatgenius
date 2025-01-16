export interface SearchResult {
  id: string;
  content: string;
  createdAt: string;
  channelId: string | null;
  dmId: string | null;
  senderName: string;
  messageIndex: number;
  channelName: string | null;
  dmRecipientName: string | null;
  parentId?: string | null;
}

export interface ScopeOption {
  id: string;
  name: string;
  type: 'workspace' | 'channel';
  icon?: string;
  description?: string;  // Added for richer UI
  color?: string;        // Added for custom styling
}

export interface BotResponse extends SearchResult {
  scope?: 'channel' | 'workspace';
  confidence?: number;   // Added for potential AI confidence scoring
  sources?: string[];    // Added for potential source tracking
} 