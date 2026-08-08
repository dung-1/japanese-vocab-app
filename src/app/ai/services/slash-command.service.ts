import { Injectable } from '@angular/core';
import { SlashCommand, SLASH_COMMANDS } from '../models/slash-command.model';

@Injectable({ providedIn: 'root' })
export class SlashCommandService {
  /** Registry của tất cả các commands hiện có */
  readonly commands: SlashCommand[] = SLASH_COMMANDS;

  /**
   * Lọc commands dựa trên nội dung user đang gõ sau ký tự '/'
   * @param query Text sau dấu '/', ví dụ: '/kan' -> lọc ra /kanji
   */
  filter(query: string): SlashCommand[] {
    const q = query.toLowerCase().replace(/^\//, '');
    if (!q) return this.commands; // Trả về tất cả nếu chỉ gõ '/'

    return this.commands.filter(c =>
      c.trigger.startsWith(q) ||
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }

  /**
   * Tìm chính xác command theo trigger.
   * @param trigger Ví dụ: 'kanji'
   */
  findByTrigger(trigger: string): SlashCommand | undefined {
    return this.commands.find(c => c.trigger === trigger.replace(/^\//, ''));
  }

  /**
   * Phân tích input để tách biệt Command và nội dung câu hỏi.
   * Ví dụ: "/kanji 説 nghĩa là gì" -> { command: {id: 'kanji', ...}, userText: '説 nghĩa là gì' }
   */
  parse(input: string): { command: SlashCommand | null; userText: string } {
    const match = input.match(/^\/(\w+)\s*(.*)/s);
    if (!match) return { command: null, userText: input };

    const trigger = match[1];
    const userText = match[2].trim();
    const command = this.findByTrigger(trigger) ?? null;

    return { command, userText };
  }
}
