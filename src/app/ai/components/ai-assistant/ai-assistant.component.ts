import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AiService } from '../../services/ai.service';
import { KnowledgeService } from '../../services/knowledge.service';
import { ConversationMemoryService } from '../../services/conversation-memory.service';
import { AiChatMessage } from '../../models/ai-chat.model';

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css'],
  standalone: false,
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  readonly ai = inject(AiService);
  readonly knowledge = inject(KnowledgeService);
  private readonly conversationMemory = inject(ConversationMemoryService);
  private readonly router = inject(Router);

  @ViewChild('chatWindow') chatWindowRef?: ElementRef<HTMLDivElement>;

  question = '';
  loading = signal(true);

  ngOnInit(): void {
    this.bootstrap();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.ai.ensureReady();
    } catch (e) {
      console.error('[ai-assistant] bootstrap error', e);
    } finally {
      this.loading.set(false);
    }
  }

  onSubmit(): void {
    const q = this.question.trim();
    if (!q || this.ai.busy()) return;
    this.question = '';
    void this.ai.ask(q);
  }

  goHome(): void {
    void this.router.navigate(['/home']);
  }

  clearChat(): void {
    this.ai.clear();
  }

  trackById(_index: number, m: AiChatMessage): string {
    return m.id;
  }

  /** Phase 4 PLAN.md: Session indicator — hiển thị trạng thái phiên hội thoại hiện tại */
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
    // Avoid forcing scroll on every change-detection cycle when nothing new appended.
    if (Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) > 40) {
      el.scrollTop = el.scrollHeight;
    }
  }
}