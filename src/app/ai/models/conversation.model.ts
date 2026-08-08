import { AiChatMessage } from './ai-chat.model';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  contextUsed?: {
    domain: string;
    itemsCount: number;
    summaryPreview: string;
  };
}

export interface ConversationSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
  title?: string;
  isActive: boolean;
}

export interface ConversationHistory {
  currentSession: ConversationSession | null;
  previousSessions: ConversationSession[];
  lastActiveAt: number;
  deviceId: string;   // ← device UUID lưu localStorage, dùng làm key Supabase
}

export const DEFAULT_CONVERSATION_HISTORY: ConversationHistory = {
  currentSession: null,
  previousSessions: [],
  lastActiveAt: 0,
  deviceId: '',
};

export function convertToConversationMessage(aiMessage: AiChatMessage): ConversationMessage {
  return {
    id: aiMessage.id,
    role: aiMessage.role,
    content: aiMessage.content,
    timestamp: aiMessage.createdAt,
    contextUsed: aiMessage.contextUsed
      ? {
          domain: aiMessage.contextUsed.domain,
          itemsCount: aiMessage.contextUsed.items.length,
          summaryPreview: aiMessage.contextUsed.summary.substring(0, 100),
        }
      : undefined,
  };
}

export function createNewSession(id?: string): ConversationSession {
  return {
    // FIX BUG-002: Strictly use UUID to match PostgreSQL uuid type.
    // Removed custom strings like 'session_...' or 'temp-...'
    id: id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-a000-${Math.random().toString(16).slice(2,14)}`),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    isActive: true,
  };
}
