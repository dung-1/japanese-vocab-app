import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { KnowledgeItem } from '../models/knowledge.model';
import {
  DOMAIN_PROMPTS,
  PromptContext,
  PromptPayload,
} from '../models/prompt.model';

@Injectable({ providedIn: 'root' })
export class PromptBuilderService {
  private readonly maxContextChars = environment.ai.maxContextChars;

  /**
   * Build context gọn từ items.
   */
  buildContext(domain: PromptContext['domain'], items: KnowledgeItem[]): PromptContext {
    const summaryParts: string[] = [];
    let totalChars = 0;
    let truncated = false;
    const used: KnowledgeItem[] = [];

    for (const item of items) {
      const snippet = this.itemToSnippet(item);
      const cost = snippet.length + 2;
      if (totalChars + cost > this.maxContextChars) {
        truncated = true;
        break;
      }
      summaryParts.push(snippet);
      used.push(item);
      totalChars += cost;
    }

    return {
      domain,
      items: used,
      summary: summaryParts.join('\n\n') || '(Không có dữ liệu liên quan)',
      truncated,
    };
  }

  build(domain: PromptContext['domain'], context: PromptContext, question: string): PromptPayload {
    const template = DOMAIN_PROMPTS[domain];
    return {
      system: template.system,
      user: template.buildUser(context, question),
      domain,
      context,
    };
  }

  /**
   * Rút gọn 1 item thành text ngắn cho model.
   */
  private itemToSnippet(item: KnowledgeItem): string {
    const r = item.raw as Record<string, unknown>;
    switch (item.domain) {
      case 'kanji-word': {
        const examples = Array.isArray(r['examples'])
          ? (r['examples'] as Array<Record<string, unknown>>)
              .slice(0, 2)
              .map((e) => `  - ${e['word']} (${e['reading']}): ${e['meaning']}`)
              .join('\n')
          : '';
        return [
          `ID: ${item.id}`,
          `Kanji: ${r['kanji']}`,
          `Âm Hán Việt: ${r['amHan'] ?? ''}`,
          `Nghĩa: ${r['nghia'] ?? ''}`,
          `On'yomi: ${r['onyomi'] ?? ''}`,
          `Kun'yomi: ${r['kunyomi'] ?? ''}`,
          examples ? `Ví dụ:\n${examples}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
      case 'vocab': {
        return [
          `ID: ${item.id}`,
          `Kanji: ${r['kanji']}`,
          `Hiragana: ${r['hiragana']}`,
          `Hán Việt: ${r['hanViet']}`,
          `Nghĩa: ${r['meaning']}`,
        ].join('\n');
      }
      case 'radical': {
        return [
          `ID: ${item.id}`,
          `Bộ thủ: ${r['radical']}`,
          `Nghĩa: ${r['meaning']}`,
          `Số nét: ${r['strokeCount']}`,
          `Pronunciations: ${(r['pronunciations'] as string[] | undefined)?.join(', ') ?? ''}`,
          `Ví dụ Kanji: ${(r['exampleKanji'] as string[] | undefined)?.join(', ') ?? ''}`,
          `Ghi nhớ: ${r['memoryTrick'] ?? ''}`,
          `Giải thích: ${r['explanation'] ?? ''}`,
        ].join('\n');
      }
      case 'reduplicative': {
        return [
          `ID: ${item.id}`,
          `Japanese: ${r['japanese']}`,
          `Romaji: ${r['romaji']}`,
          `Tiếng Việt: ${r['vietnamese']}`,
          `Loại: ${r['category']}`,
        ].join('\n');
      }
      default:
        return `ID: ${item.id}\n` + JSON.stringify(r).slice(0, 300);
    }
  }
}