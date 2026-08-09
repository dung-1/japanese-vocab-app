import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AiService } from '../../services/ai.service';
import { KnowledgeService } from '../../services/knowledge.service';
import { ConversationMemoryService } from '../../services/conversation-memory.service';
import { AiChatMessage } from '../../models/ai-chat.model';
import { SlashCommandService } from '../../services/slash-command.service';
import { SlashCommand } from '../../models/slash-command.model';
import { DbSession } from '../../services/supabase-chat.service';

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css'],
  standalone: false,
})
export class AiAssistantComponent implements OnInit {
  readonly ai = inject(AiService);
  readonly knowledge = inject(KnowledgeService);
  private readonly conversationMemory = inject(ConversationMemoryService);
  private readonly router = inject(Router);
  readonly slashSvc = inject(SlashCommandService);

  @ViewChild('chatWindow') chatWindowRef?: ElementRef<HTMLDivElement>;
  @ViewChild('questionInput') questionInputRef?: ElementRef<HTMLInputElement>;

  question = '';
  loading = signal(true);
  
  // Sidebar state
  sidebarOpen = signal(true);
  sessions = signal<DbSession[]>([]);
  sessionsLoading = signal(false);
  currentSessionId = signal<string | null>(null);

  // Slash command state
  showSlashMenu = false;
  slashMenuCommands: SlashCommand[] = [];
  slashMenuIndex = 0;
  activeCommand: SlashCommand | null = null;

  ngOnInit(): void {
    this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.ai.ensureReady();
      await this.loadSessions();
    } catch (e) {
      console.error('[ai-assistant] bootstrap error', e);
    } finally {
      this.loading.set(false);
    }
  }

  async loadSessions(): Promise<void> {
    this.sessionsLoading.set(true);
    try {
      const sessions = await this.conversationMemory.getAllSessions();
      this.sessions.set(sessions);
      
      const current = this.conversationMemory.getCurrentSession();
      this.currentSessionId.set(current?.id ?? null);
    } catch (e) {
      console.error('[ai-assistant] loadSessions error', e);
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  async onSessionSelected(sessionId: string): Promise<void> {
    this.currentSessionId.set(sessionId);
    const messages = await this.conversationMemory.loadSession(sessionId);
    this.ai.messages.set(messages);
    this.scrollToBottom();
  }

  async onNewChat(): Promise<void> {
    const newId = await this.conversationMemory.startNewChat();
    if (newId) {
      this.currentSessionId.set(newId);
      this.ai.messages.set([]);
      await this.loadSessions();
    }
  }

  async onDeleteSession(sessionId: string): Promise<void> {
    if (confirm('Bạn có chắc chắn muốn xóa phiên chat này?')) {
      await this.conversationMemory.deleteSession(sessionId);
      await this.loadSessions();
      if (this.currentSessionId() === sessionId) {
        await this.onNewChat();
      }
    }
  }

  async onRenameSession(event: { id: string; title: string }): Promise<void> {
    await this.conversationMemory.renameSession(event.id, event.title);
    await this.loadSessions();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  onInputChange(value: string): void {
    this.question = value;
    if (value.startsWith('/')) {
      this.slashMenuCommands = this.slashSvc.filter(value);
      this.showSlashMenu = this.slashMenuCommands.length > 0;
      this.slashMenuIndex = 0;
    } else {
      this.showSlashMenu = false;
      if (this.activeCommand && !value.startsWith(`/${this.activeCommand.trigger}`)) {
        this.activeCommand = null;
      }
    }
  }

  onKeydown(e: KeyboardEvent): void {
    if (!this.showSlashMenu) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.slashMenuIndex = (this.slashMenuIndex + 1) % this.slashMenuCommands.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.slashMenuIndex = (this.slashMenuIndex - 1 + this.slashMenuCommands.length) % this.slashMenuCommands.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.selectCommand(this.slashMenuCommands[this.slashMenuIndex]);
    } else if (e.key === 'Escape') {
      this.showSlashMenu = false;
    }
  }

  selectCommand(cmd: SlashCommand): void {
    this.question = cmd.prefill;
    this.activeCommand = cmd;
    this.showSlashMenu = false;
    setTimeout(() => this.questionInputRef?.nativeElement.focus(), 0);
  }

  removeActiveCommand(): void {
    this.activeCommand = null;
    this.question = '';
    setTimeout(() => this.questionInputRef?.nativeElement.focus(), 0);
  }

  onMenuDismissed(): void {
    this.showSlashMenu = false;
  }

  onSubmit(): void {
    const q = this.question.trim();
    if (!q || this.ai.busy()) return;

    const { command, userText } = this.slashSvc.parse(q);

    this.question = '';
    this.activeCommand = null;
    this.showSlashMenu = false;

    if (command?.domain) {
      void this.ai.askInDomain(userText || q, command.domain);
    } else if (command?.promptHint) {
      void this.ai.askWithHint(userText || q, command.promptHint);
    } else {
      void this.ai.ask(q);
    }
  }

  goHome(): void {
    void this.router.navigate(['/home']);
  }

  clearChat(): void {
    this.ai.clear();
    void this.onNewChat();
  }

  trackById(_index: number, m: any): string {
    return m.id;
  }

  sessionInfo(): { label: string; messageCount: number } | null {
    const session = this.conversationMemory.getCurrentSession();
    if (!session) return null;
    return {
      label: session.messages.length > 0 ? 'Phiên đang tiếp tục' : 'Phiên mới',
      messageCount: session.messages.length,
    };
  }

  lastIsStreaming(): boolean {
    const arr = this.ai.messages();
    if (arr.length === 0) return false;
    return arr[arr.length - 1]?.streaming === true;
  }

  private scrollToBottom(): void {
    if (!this.chatWindowRef) return;
    const el = this.chatWindowRef.nativeElement;
    if (Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) > 40) {
      el.scrollTop = el.scrollHeight;
    }
  }

  onMessagesUpdate(): void {
    this.scrollToBottom();
  }
  autoResize(event: Event): void {
  const textarea = event.target as HTMLTextAreaElement;

  textarea.style.height = 'auto';

  const maxHeight = 150;

  if (textarea.scrollHeight <= maxHeight) {
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.overflowY = 'hidden';
  } else {
    textarea.style.height = `${maxHeight}px`;
    textarea.style.overflowY = 'auto';
  }
}
}
