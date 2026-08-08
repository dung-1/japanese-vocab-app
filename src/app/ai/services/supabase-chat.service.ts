import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AiChatMessage } from '../models/ai-chat.model';

export interface DbSession {
  id: string;
  device_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  context_domain?: string;
  context_items?: number;
}

const DEVICE_ID_KEY = 'jv_device_id';

@Injectable({ providedIn: 'root' })
export class SupabaseChatService {
  private readonly platformId = inject(PLATFORM_ID);
  private client!: SupabaseClient;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const deviceId = this.getOrCreateDeviceId();
        
        // FIX BUG-001: Add custom header x-device-id to satisfy RLS policies
        // based on current_setting('request.headers', true)
        this.client = createClient(environment.supabase.url, environment.supabase.anonKey, {
          auth: { persistSession: false },
          global: {
            headers: {
              'x-device-id': deviceId,
            },
          },
        });
      } catch (e) {
        console.warn('[SupabaseChatService] Failed to init', e);
      }
    }
  }

  getOrCreateDeviceId(): string {
    if (!isPlatformBrowser(this.platformId)) return 'ssr-placeholder';
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'temp-' + Date.now();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  async getSessions(deviceId: string): Promise<DbSession[]> {
    if (!this.client) return [];
    const { data, error } = await this.client.from('chat_sessions').select('*').eq('device_id', deviceId).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as DbSession[]) ?? [];
  }

  async createSession(deviceId: string, title = 'Chat mới'): Promise<DbSession | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.from('chat_sessions').insert({ device_id: deviceId, title }).select().single();
    if (error) throw error;
    return data as DbSession;
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('chat_sessions').update({ title, updated_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) throw error;
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('chat_sessions').delete().eq('id', sessionId);
    if (error) throw error;
  }

  async touchSession(sessionId: string): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);
    if (error) throw error;
  }

  async getMessages(sessionId: string): Promise<DbMessage[]> {
    if (!this.client) return [];
    const { data, error } = await this.client.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    if (error) throw error;
    return (data as DbMessage[]) ?? [];
  }

  async saveMessage(sessionId: string, msg: AiChatMessage): Promise<void> {
    if (!this.client || msg.streaming) return;
    const { error } = await this.client.from('chat_messages').upsert({
      id: msg.id,
      session_id: sessionId,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      created_at: new Date(msg.createdAt).toISOString(),
      context_domain: msg.contextUsed?.domain,
      context_items: msg.contextUsed?.items?.length ?? 0,
    }, { onConflict: 'id' });
    if (error) throw error;
  }

  mapToAiMessages(dbMessages: DbMessage[]): AiChatMessage[] {
    return dbMessages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.created_at).getTime(),
      streaming: false,
    }));
  }
}
