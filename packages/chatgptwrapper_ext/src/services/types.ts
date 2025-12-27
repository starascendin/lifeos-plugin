export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (content: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  onStatus?: (status: string) => void;
}

export interface ChatGPTContext {
  conversationId: string | null;
  parentMessageId: string;
}

export interface ClaudeContext {
  conversationId: string | null;
  claudeOrgUuid: string | null;
}

export interface GeminiContext {
  geminiContextIds: string[];
}

export interface XaiContext {
  conversationHistory: ChatMessage[];
}
