import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ConversationHistory,
  ConversationSession,
  ConversationMessage,
  DEFAULT_CONVERSATION_HISTORY,
  createNewSession,
  convertToConversationMessage,
} from '../models/conversation.model';
import { AiChatMessage } from '../models/ai-chat.model';
import { SupabaseChatService, DbSession } from './supabase-chat.service';

// ── Constants ──────────────────────────────────────────────────────────────────

const AUTO_TITLE_MAX_CHARS = 40;

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ConversationMemoryService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseChatService);

  private history: ConversationHistory = { ...DEFAULT_CONVERSATION_HISTORY };

  /** Signal: danh sách sessions cho sidebar */
  readonly sessions = signal<DbSession[]>([]);
  /** Signal: đang tải sessions */
  readonly sessionsLoading = signal(false);

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Khởi động: lấy device_id, load sessions từ Supabase,
   * resume session mới nhất hoặc tạo mới.
   * Gọi từ ai-assistant.component.ngOnInit()
   */
  async initializeSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    this.history.deviceId = this.supabase.getOrCreateDeviceId();
    this.sessionsLoading.set(true);

    try {
      const dbSessions = await this.supabase.getSessions(this.history.deviceId);
      this.sessions.set(dbSessions);

      if (dbSessions.length > 0) {
        // Resume session mới nhất
        const latest = dbSessions[0];
        await this._activateSession(latest.id, latest.title);
      } else {
        // Tạo session đầu tiên
        await this._createNewSession();
      }
    } catch (e) {
      console.warn('[ConversationMemory] initializeSession error, using local fallback', e);
      // Fallback: tạo session local (không persist)
      this.history.currentSession = createNewSession();
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  // ── Message ops ───────────────────────────────────────────────────────────

  /**
   * Thêm message vào session hiện tại + persist vào Supabase.
   * Gọi từ ai.service.ts sau mỗi user/assistant message.
   */
  async addMessage(message: AiChatMessage): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.history.currentSession) return;
    // Không lưu messages đang streaming
    if (message.streaming) return;

    const convMessage: ConversationMessage = convertToConversationMessage(message);
    this.history.currentSession.messages.push(convMessage);
    this.history.currentSession.updatedAt = Date.now();
    this.history.lastActiveAt = Date.now();

    // Persist vào Supabase (fire-and-forget, không await để không chặn UI)
    void this.supabase.saveMessage(this.history.currentSession.id, message);
    void this.supabase.touchSession(this.history.currentSession.id);

    // Auto-generate title từ tin nhắn user đầu tiên
    if (
      message.role === 'user' &&
      this.history.currentSession.messages.filter((m) => m.role === 'user').length === 1
    ) {
      const title = message.content.substring(0, AUTO_TITLE_MAX_CHARS).trim();
      this.history.currentSession.title = title;
      void this.supabase.updateSessionTitle(this.history.currentSession.id, title);
      // Cập nhật signal sessions với title mới
      this.sessions.update((list) =>
        list.map((s) =>
          s.id === this.history.currentSession!.id ? { ...s, title } : s
        )
      );
    }
  }

  // ── Session ops ───────────────────────────────────────────────────────────

  /**
   * Lấy toàn bộ sessions của device cho sidebar.
   */
  async getAllSessions(): Promise<DbSession[]> {
    if (!isPlatformBrowser(this.platformId)) return [];
    return this.supabase.getSessions(this.history.deviceId);
  }

  /**
   * Tải messages của 1 session cụ thể và set làm currentSession.
   * Gọi khi user click vào session trong sidebar.
   * Trả về AiChatMessage[] để component set vào ai.messages signal.
   */
  async loadSession(sessionId: string): Promise<AiChatMessage[]> {
    this.sessionsLoading.set(true);
    try {
      const dbMessages = await this.supabase.getMessages(sessionId);
      const aiMessages = this.supabase.mapToAiMessages(dbMessages);

      // Set currentSession với messages đã load
      const dbSession = this.sessions().find((s) => s.id === sessionId);
      this.history.currentSession = {
        id: sessionId,
        title: dbSession?.title,
        createdAt: dbSession ? new Date(dbSession.created_at).getTime() : Date.now(),
        updatedAt: dbSession ? new Date(dbSession.updated_at).getTime() : Date.now(),
        isActive: true,
        messages: dbMessages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
        })),
      };

      return aiMessages;
    } catch (e) {
      console.warn('[ConversationMemory] loadSession error', e);
      return [];
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  /**
   * Tạo chat mới: tạo session trên Supabase, reset currentSession.
   * Trả về session id mới (để component clear ai.messages).
   */
  async startNewChat(): Promise<string | null> {
    if (!isPlatformBrowser(this.platformId)) return null;

    const dbSession = await this.supabase.createSession(this.history.deviceId, 'Chat mới');
    if (!dbSession) return null;

    this.history.currentSession = createNewSession(dbSession.id);
    this.history.currentSession.title = dbSession.title;

    // Thêm vào đầu danh sách sessions
    this.sessions.update((list) => [dbSession, ...list]);

    return dbSession.id;
  }

  /**
   * Xóa session: xóa trên Supabase, remove khỏi signal.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.supabase.deleteSession(sessionId);
    this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
  }

  /**
   * Đổi tên session.
   */
  async renameSession(sessionId: string, title: string): Promise<void> {
    await this.supabase.updateSessionTitle(sessionId, title);
    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
    if (this.history.currentSession?.id === sessionId) {
      this.history.currentSession.title = title;
    }
  }

  /**
   * Xóa chat hiện tại (clear messages, tạo session mới).
   * Giữ lại session cũ trong Supabase / sidebar.
   */
  async clearCurrentConversation(): Promise<string | null> {
    return this.startNewChat();
  }

  // ── Prompt helpers ─────────────────────────────────────────────────────────

  getCurrentSession(): ConversationSession | null {
    return this.history.currentSession;
  }

  getRecentHistory(maxMessages = 6): ConversationMessage[] {
    if (!this.history.currentSession) return [];
    const messages = this.history.currentSession.messages;
    return messages.slice(-maxMessages);
  }

  getHistoryForPrompt(maxTokens = 1000): ConversationMessage[] {
    if (!this.history.currentSession) return [];
    const charsPerToken = 4;
    let totalChars = 0;
    const result: ConversationMessage[] = [];
    const messages = [...this.history.currentSession.messages].reverse();
    for (const message of messages) {
      const cost = message.content.length + 50;
      if (totalChars + cost > maxTokens * charsPerToken) break;
      result.unshift(message);
      totalChars += cost;
    }
    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _activateSession(sessionId: string, title?: string): Promise<void> {
    const dbMessages = await this.supabase.getMessages(sessionId);
    const dbSession = this.sessions().find((s) => s.id === sessionId);

    this.history.currentSession = {
      id: sessionId,
      title,
      createdAt: dbSession ? new Date(dbSession.created_at).getTime() : Date.now(),
      updatedAt: dbSession ? new Date(dbSession.updated_at).getTime() : Date.now(),
      isActive: true,
      messages: dbMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
      })),
    };
  }

  private async _createNewSession(): Promise<void> {
    const dbSession = await this.supabase.createSession(this.history.deviceId, 'Chat mới');
    if (dbSession) {
      this.history.currentSession = createNewSession(dbSession.id);
      this.sessions.update((list) => [dbSession, ...list]);
    } else {
      this.history.currentSession = createNewSession();
    }
  }
}
