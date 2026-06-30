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
}

export const DEFAULT_CONVERSATION_HISTORY: ConversationHistory = {
  currentSession: null,
  previousSessions: [],
  lastActiveAt: 0
};

export function convertToConversationMessage(aiMessage: AiChatMessage): ConversationMessage {
  return {
    id: aiMessage.id,
    role: aiMessage.role,
    content: aiMessage.content,
    timestamp: aiMessage.createdAt,
    contextUsed: aiMessage.contextUsed ? {
      domain: aiMessage.contextUsed.domain,
      itemsCount: aiMessage.contextUsed.items.length,
      summaryPreview: aiMessage.contextUsed.summary.substring(0, 100)
    } : undefined
  };
}

export function createNewSession(): ConversationSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    isActive: true
  };
}