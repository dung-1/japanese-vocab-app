import { Injectable, inject, signal } from '@angular/core';
import { KnowledgeDomain } from '../models/knowledge.model';
import { AiChatMessage } from '../models/ai-chat.model';
import { PromptContext } from '../models/prompt.model';
import { PromptBuilderService } from './prompt-builder.service';
import { KnowledgeService } from './knowledge.service';
import { SearchEngineService } from './search-engine.service';
import { AiSettingsService } from './ai-settings.service';
import { ProviderFactory } from '../providers/provider-factory.service';
import { AiProvider, ChatStreamHandle } from '../providers/ai-provider.interface';
import { validateAnswer, ValidationResult } from '../utils/response-validator.util';
import { ConversationMemoryService } from './conversation-memory.service';
import { EnhancedPromptBuilderService } from './enhanced-prompt-builder.service';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly knowledge = inject(KnowledgeService);
  private readonly search = inject(SearchEngineService);
  private readonly promptBuilder = inject(PromptBuilderService);
  private readonly settings = inject(AiSettingsService);
  private readonly factory = inject(ProviderFactory);
  private readonly conversationMemory = inject(ConversationMemoryService);
  private readonly enhancedPromptBuilder = inject(EnhancedPromptBuilderService);

  readonly messages = signal<AiChatMessage[]>([]);
  readonly busy = signal(false);
  readonly lastError = signal<string | null>(null);

  private currentAbort: (() => void) | null = null;

  private get provider(): AiProvider {
    const s = this.settings.get();
    // Always re-configure providers with latest settings
    this.factory.configureLocal('http://localhost:11434');
    this.factory.configureCloud(s.cloudApiKey, s.model);
    return this.factory.get(s.provider);
  }

  async ensureReady(): Promise<void> {
    if (!this.knowledge.loaded()) {
      await this.knowledge.loadAll();
    }
    // Initialize conversation session
    this.conversationMemory.initializeSession();
  }

  async ask(question: string): Promise<AiChatMessage | null> {
    const trimmed = (question ?? '').trim();
    if (!trimmed) return null;
    if (this.busy()) return null;

    this.lastError.set(null);
    this.busy.set(true);

    const domain: KnowledgeDomain = this.search.detectDomain(trimmed);
    await this.ensureReady();

    const items = this.knowledge.getItemsByDomain(domain);
    const hits = this.search.search(trimmed, items, 5);
    const context: PromptContext = this.promptBuilder.buildContext(
      domain,
      hits.map((h) => h.item),
    );
    
    // Use enhanced prompt builder with conversation history
    const payload = this.enhancedPromptBuilder.buildWithHistory(
      domain,
      context,
      trimmed
    );

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      contextUsed: context,
    };
    this.messages.update((arr) => [...arr, userMsg]);
    
    // Add user message to conversation memory
    this.conversationMemory.addMessage(userMsg);

    const asstMsg: AiChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      contextUsed: context,
      streaming: true,
    };
    this.messages.update((arr) => [...arr, asstMsg]);

    return this.runChat(payload.system, payload.user, asstMsg, context);
  }

  async askInDomain(
    question: string,
    domain: KnowledgeDomain,
  ): Promise<AiChatMessage | null> {
    const trimmed = (question ?? '').trim();
    if (!trimmed) return null;
    if (this.busy()) return null;
    this.lastError.set(null);
    this.busy.set(true);
    await this.ensureReady();

    const items = this.knowledge.getItemsByDomain(domain);
    const hits = this.search.search(trimmed, items, 5);
    const context = this.promptBuilder.buildContext(
      domain,
      hits.map((h) => h.item),
    );
    
    // Use enhanced prompt builder with conversation history
    const payload = this.enhancedPromptBuilder.buildWithHistory(
      domain,
      context,
      trimmed
    );

    const userMsg: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      contextUsed: context,
    };
    this.messages.update((arr) => [...arr, userMsg]);
    
    // Add user message to conversation memory
    this.conversationMemory.addMessage(userMsg);

    const asstMsg: AiChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      contextUsed: context,
      streaming: true,
    };
    this.messages.update((arr) => [...arr, asstMsg]);

    return this.runChat(payload.system, payload.user, asstMsg, context);
  }

  abort(): void {
    if (this.currentAbort) {
      this.currentAbort();
      this.currentAbort = null;
      this.busy.set(false);
    }
  }

  clear(): void {
    this.abort();
    this.messages.set([]);
    // Clear conversation memory as well
    this.conversationMemory.clearCurrentConversation();
  }

  prependUser(text: string): void {
    const m: AiChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    this.messages.update((arr) => [...arr, m]);
  }

  private runChat(
    system: string,
    user: string,
    asstMsg: AiChatMessage,
    context: PromptContext,
  ): Promise<AiChatMessage | null> {
    const s = this.settings.get();
    let finalContent = '';
    return new Promise<AiChatMessage | null>((resolve) => {
      this.provider
        .chat(
          {
            system,
            user,
            model: s.model,
            temperature: s.temperature,
            topK: s.topK,
            stream: s.streaming,
          },
          (token) => {
            finalContent += token;
            const updated = { ...asstMsg, content: finalContent };
            this.messages.update((arr) =>
              arr.map((m) => (m.id === asstMsg.id ? updated : m)),
            );
          },
          () => {
            const validation: ValidationResult = validateAnswer(
              finalContent,
              context.items,
            );
            const finished: AiChatMessage = {
              ...asstMsg,
              content: finalContent,
              streaming: false,
              sourceCitations: validation.matchedIds,
            };
            this.messages.update((arr) =>
              arr.map((m) => (m.id === asstMsg.id ? finished : m)),
            );
            
            // Add assistant message to conversation memory
            this.conversationMemory.addMessage(finished);
            
            this.busy.set(false);
            this.currentAbort = null;
            resolve(finished);
          },
          (err) => {
            this.lastError.set(err.message);
            const errored: AiChatMessage = {
              ...asstMsg,
              content: finalContent || `❌ Lỗi: ${err.message}`,
              streaming: false,
              error: err.message,
            };
            this.messages.update((arr) =>
              arr.map((m) => (m.id === asstMsg.id ? errored : m)),
            );
            this.busy.set(false);
            this.currentAbort = null;
            resolve(errored);
          },
        )
        .then((handle: ChatStreamHandle) => {
          this.currentAbort = () => handle.abort();
        });
    });
  }
}
