import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConversationHistory, ConversationSession, ConversationMessage, DEFAULT_CONVERSATION_HISTORY, createNewSession, convertToConversationMessage } from '../models/conversation.model';
import { AiChatMessage } from '../models/ai-chat.model';

const CONVERSATION_STORAGE_KEY = 'ai_conversation_history_v1';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

@Injectable({ providedIn: 'root' })
export class ConversationMemoryService {
  private readonly platformId = inject(PLATFORM_ID);
  
  private history: ConversationHistory = { ...DEFAULT_CONVERSATION_HISTORY };
  private isInitialized = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromStorage();
      // Listen for storage events from other tabs
      window.addEventListener('storage', (e) => {
        if (e.key === CONVERSATION_STORAGE_KEY && e.newValue) {
          try {
            this.loadFromStorage();
          } catch {
            // ignore
          }
        }
      });
    }
  }

  /**
   * Initialize or resume conversation session
   */
  initializeSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const now = Date.now();
    
    // Check if we have an active session that hasn't expired
    if (this.history.currentSession && this.history.currentSession.isActive) {
      const timeSinceLastActive = now - this.history.lastActiveAt;
      if (timeSinceLastActive < SESSION_TIMEOUT_MS) {
        // Resume existing session
        console.log('[ConversationMemory] Resuming existing session', this.history.currentSession.id);
        return;
      } else {
        // Session expired, archive it
        this.archiveCurrentSession();
      }
    }
    
    // Create new session
    this.history.currentSession = createNewSession();
    this.history.lastActiveAt = now;
    this.saveToStorage();
    console.log('[ConversationMemory] Created new session', this.history.currentSession.id);
  }

  /**
   * Add a message to current conversation
   */
  addMessage(message: AiChatMessage): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.history.currentSession) return;
    
    const convMessage: ConversationMessage = convertToConversationMessage(message);
    this.history.currentSession.messages.push(convMessage);
    this.history.currentSession.updatedAt = Date.now();
    this.history.lastActiveAt = Date.now();
    
    this.saveToStorage();
  }

  /**
   * Get recent conversation history
   */
  getRecentHistory(maxMessages: number = 6): ConversationMessage[] {
    if (!this.history.currentSession) return [];
    
    const messages = this.history.currentSession.messages;
    return messages.slice(-maxMessages);
  }

  /**
   * Get current session info
   */
  getCurrentSession(): ConversationSession | null {
    return this.history.currentSession;
  }

  /**
   * Clear current conversation
   */
  clearCurrentConversation(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (this.history.currentSession) {
      this.archiveCurrentSession();
    }
    
    this.history.currentSession = createNewSession();
    this.history.lastActiveAt = Date.now();
    this.saveToStorage();
  }

  /**
   * Get conversation history for prompt building
   */
  getHistoryForPrompt(maxTokens: number = 1000): ConversationMessage[] {
    if (!this.history.currentSession) return [];
    
    // Simple token estimation: ~4 chars per token
    const charsPerToken = 4;
    let totalChars = 0;
    const result: ConversationMessage[] = [];
    
    // Get messages in reverse order (newest first) for truncation
    const messages = [...this.history.currentSession.messages].reverse();
    
    for (const message of messages) {
      const messageChars = message.content.length + 50; // +50 for metadata
      if (totalChars + messageChars > maxTokens * charsPerToken) {
        break;
      }
      result.unshift(message); // Add to beginning to maintain chronological order
      totalChars += messageChars;
    }
    
    return result;
  }

  /**
   * Archive current session and start new one
   */
  private archiveCurrentSession(): void {
    if (!this.history.currentSession) return;
    
    // Only archive sessions with actual conversation
    if (this.history.currentSession.messages.length > 0) {
      // Set title based on first user message
      if (!this.history.currentSession.title) {
        const firstUserMessage = this.history.currentSession.messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          this.history.currentSession.title = firstUserMessage.content.substring(0, 50);
        }
      }
      
      this.history.currentSession.isActive = false;
      this.history.previousSessions.unshift(this.history.currentSession);
      
      // Keep only last 20 sessions
      if (this.history.previousSessions.length > 20) {
        this.history.previousSessions = this.history.previousSessions.slice(0, 20);
      }
    }
  }

  /**
   * Load conversation history from localStorage
   */
  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      const raw = localStorage.getItem(CONVERSATION_STORAGE_KEY);
      if (!raw) {
        this.history = { ...DEFAULT_CONVERSATION_HISTORY };
        return;
      }
      
      const parsed = JSON.parse(raw);
      this.history = {
        currentSession: parsed.currentSession ? this.validateSession(parsed.currentSession) : null,
        previousSessions: Array.isArray(parsed.previousSessions) 
          ? parsed.previousSessions.map((s: any) => this.validateSession(s)).slice(0, 20)
          : [],
        lastActiveAt: parsed.lastActiveAt || Date.now()
      };
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('[ConversationMemory] Failed to load from storage, using default', error);
      this.history = { ...DEFAULT_CONVERSATION_HISTORY };
    }
  }

  /**
   * Save conversation history to localStorage
   */
  private saveToStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    try {
      // Clean up old sessions before saving
      this.cleanupOldSessions();
      localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.warn('[ConversationMemory] Failed to save to storage', error);
      // Ignore quota errors
    }
  }

  /**
   * Validate and clean session data
   */
  private validateSession(session: any): ConversationSession {
    return {
      id: session.id || `session_${Date.now()}`,
      createdAt: session.createdAt || Date.now(),
      updatedAt: session.updatedAt || Date.now(),
      messages: Array.isArray(session.messages) 
        ? session.messages.map((m: any) => this.validateMessage(m))
        : [],
      title: session.title || undefined,
      isActive: session.isActive !== undefined ? session.isActive : true
    };
  }

  /**
   * Validate and clean message data
   */
  private validateMessage(message: any): ConversationMessage {
    return {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user',
      content: message.content || '',
      timestamp: message.timestamp || Date.now(),
      contextUsed: message.contextUsed ? {
        domain: message.contextUsed.domain || '',
        itemsCount: message.contextUsed.itemsCount || 0,
        summaryPreview: message.contextUsed.summaryPreview || ''
      } : undefined
    };
  }

  /**
   * Clean up old sessions to manage storage space
   */
  private cleanupOldSessions(): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    this.history.previousSessions = this.history.previousSessions.filter(session => {
      return (now - session.updatedAt) < maxAge;
    });
  }
}