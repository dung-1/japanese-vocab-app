import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AiChatMessage } from '../../models/ai-chat.model';

@Component({
  selector: 'app-ai-chat-bubble',
  templateUrl: './ai-chat-bubble.component.html',
  styleUrls: ['./ai-chat-bubble.component.css'],
  standalone: false,
})
export class AiChatBubbleComponent {
  @Input() message!: AiChatMessage;

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Mini markdown: chuyển `**bold**`, `*italic*`, newline thành <br>, escape HTML.
   */
  renderContent(): SafeHtml {
    const raw = this.message?.content ?? '';
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const formatted = escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }
}