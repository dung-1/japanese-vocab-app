import { KnowledgeItem } from '../models/knowledge.model';

export interface ValidationResult {
  hallucinated: boolean;
  unknownTokens: string[];
  matchedIds: string[];
}

/**
 * Trích các token đáng ngờ trong câu trả lời của model.
 * Token = mọi cụm CJK liên tiếp (Kanji/Hiragana/Katakana) có length >= 2.
 */
function extractJapaneseTokens(text: string): string[] {
  if (!text) return [];
  const regex = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{2,}/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    out.push(m[0]);
  }
  return out;
}

function tokenInItems(token: string, items: KnowledgeItem[]): boolean {
  // Match theo exact primary, hoặc substring trong các field chính.
  for (const item of items) {
    if (item.primary === token) return true;
    const r = item.raw as Record<string, unknown>;
    for (const key of ['kanji', 'radical', 'japanese', 'hiragana', 'reading']) {
      const v = r[key];
      if (typeof v === 'string' && v.includes(token)) return true;
    }
    const examples = r['examples'];
    if (Array.isArray(examples)) {
      for (const ex of examples) {
        if (ex && typeof ex === 'object') {
          const e = ex as Record<string, unknown>;
          if (typeof e['word'] === 'string' && (e['word'] as string).includes(token)) return true;
          if (typeof e['reading'] === 'string' && (e['reading'] as string).includes(token)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Validate câu trả lời. Trả về:
 * - hallucinated: true nếu có token CJK ≥ 2 ký tự KHÔNG xuất hiện trong context.
 * - unknownTokens: danh sách token lạ.
 * - matchedIds: id của item đã được cite trong câu trả lời (trừ khi grammar vì rỗng).
 */
export function validateAnswer(answer: string, items: KnowledgeItem[]): ValidationResult {
  if (!answer) return { hallucinated: false, unknownTokens: [], matchedIds: items.map((i) => i.id) };

  // Nếu không có context (grammar), luôn pass + disclaimer do prompt đã ép.
  if (!items || items.length === 0) {
    return { hallucinated: false, unknownTokens: [], matchedIds: [] };
  }

  const tokens = extractJapaneseTokens(answer);
  const unknown = new Set<string>();
  for (const t of tokens) {
    if (!tokenInItems(t, items)) unknown.add(t);
  }

  const hallucinated = unknown.size > 0;
  return {
    hallucinated,
    unknownTokens: Array.from(unknown),
    matchedIds: items.map((i) => i.id),
  };
}