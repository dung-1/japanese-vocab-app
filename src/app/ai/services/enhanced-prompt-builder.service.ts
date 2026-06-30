import { Injectable } from '@angular/core';
import { PromptBuilderService } from './prompt-builder.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { PromptContext, PromptPayload } from '../models/prompt.model';
import { ConversationMessage } from '../models/conversation.model';

@Injectable({ providedIn: 'root' })
export class EnhancedPromptBuilderService {
  constructor(
    private readonly basePromptBuilder: PromptBuilderService,
    private readonly conversationMemory: ConversationMemoryService
  ) {}

  /**
   * Build enhanced prompt with conversation history
   */
  buildWithHistory(
    domain: string,
    context: PromptContext,
    question: string,
    maxHistoryTokens: number = 800
  ): PromptPayload {
    // First build the base prompt using existing logic
    const basePrompt = this.basePromptBuilder.build(domain as any, context, question);
    
    // Get conversation history
    const history = this.conversationMemory.getHistoryForPrompt(maxHistoryTokens);
    
    // If no history, return base prompt
    if (history.length === 0) {
      return basePrompt;
    }
    
    // Build history section
    const historySection = this.buildHistorySection(history);
    
    // Enhance the user prompt with history
    const enhancedUserPrompt = [
      historySection,
      '[CÂU HỎI HIỆN TẠI]',
      question
    ].join('\n\n');
    
    return {
      ...basePrompt,
      user: enhancedUserPrompt
    };
  }

  /**
   * Build formatted history section for prompt
   */
  private buildHistorySection(history: ConversationMessage[]): string {
    if (history.length === 0) return '';
    
    const lines: string[] = ['[LỊCH SỬ HỘI THOẠI GẦN ĐÂY]'];
    
    for (const message of history) {
      const roleLabel = message.role === 'user' ? 'Người dùng' : 
                       message.role === 'assistant' ? 'Trợ lý AI' : 'Hệ thống';
      
      lines.push(`${roleLabel}: ${message.content}`);
    }
    
    lines.push('[HẾT LỊCH SỬ]');
    
    return lines.join('\n');
  }

  /**
   * Build context with conversation awareness
   */
  buildContextWithAwareness(
    domain: string,
    items: any[], // KnowledgeItem[]
    question: string
  ): PromptContext {
    // Use base context building logic
    const baseContext = this.basePromptBuilder.buildContext(domain as any, items);
    
    // Get recent conversation to understand context
    const recentHistory = this.conversationMemory.getRecentHistory(3);
    
    // If we have conversation history, we might want to adjust context
    // For now, we'll keep the base context but this is where we could enhance it
    if (recentHistory.length > 0) {
      // This is where we could implement reference resolution
      // e.g., detect "kanji trên" and resolve it based on previous messages
    }
    
    return baseContext;
  }
}