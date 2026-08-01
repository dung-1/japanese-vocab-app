import {
  KanjiRadicalRaw,
  KanjiWordRaw,
  KnowledgeItem,
  ReduplicativeRaw,
  VocabRaw,
} from '../models/knowledge.model';
import { extractKanji } from './tokenizer.util';
import { normalizeJa, normalizeQuery, normalizeVi } from './string-normalize.util';

/**
 * Trích các token có thể tìm kiếm từ 1 item.
 */
export function buildSearchTokens(item: KnowledgeItem): string[] {
  const tokens = new Set<string>();
  const raw = item.raw as Record<string, unknown>;

  // Common fields
  for (const key of ['kanji', 'radical', 'japanese', 'hiragana', 'hanViet', 'amHan', 'nghia', 'meaning', 'romaji', 'vietnamese', 'pattern', 'core_nuance', 'ai_ollama_prompt_hint']) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) {
      tokens.add(normalizeQuery(v));
      // Thêm cả phiên bản normalize riêng
      tokens.add(normalizeVi(v));
      tokens.add(normalizeJa(v));
    }
  }

  // Arrays
  for (const key of ['exampleKanji', 'pronunciations']) {
    const arr = raw[key];
    if (Array.isArray(arr)) {
      for (const x of arr) {
        if (typeof x === 'string') tokens.add(normalizeQuery(x));
      }
    }
  }

  // Examples (kanji-words)
  const examples = raw['examples'];
  if (Array.isArray(examples)) {
    for (const ex of examples) {
      if (ex && typeof ex === 'object') {
        const e = ex as Record<string, unknown>;
        if (typeof e['word'] === 'string') tokens.add(normalizeQuery(e['word'] as string));
        if (typeof e['reading'] === 'string') tokens.add(normalizeQuery(e['reading'] as string));
        if (typeof e['meaning'] === 'string') tokens.add(normalizeVi(e['meaning'] as string));
        if (typeof e['japanese'] === 'string') tokens.add(normalizeQuery(e['japanese'] as string));
        if (typeof e['romaji'] === 'string') tokens.add(normalizeQuery(e['romaji'] as string));
        if (typeof e['vietnamese'] === 'string') tokens.add(normalizeVi(e['vietnamese'] as string));
        if (typeof e['highlight_keyword'] === 'string') tokens.add(normalizeQuery(e['highlight_keyword'] as string));
      }
    }
  }

  // Mnemonic
  const mnem = raw['mnemonic'];
  if (mnem && typeof mnem === 'object') {
    const text = (mnem as Record<string, unknown>)['text'];
    if (typeof text === 'string') tokens.add(normalizeVi(text));
  }

  // Memory trick + explanation
  for (const key of ['memoryTrick', 'explanation']) {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) tokens.add(normalizeVi(v));
  }

  // Category
  const cat = raw['category'];
  if (typeof cat === 'string') tokens.add(normalizeVi(cat));

  // Kanji chars (để match query "kanji 食")
  const primary = item.primary;
  if (primary) {
    for (const k of extractKanji(primary)) tokens.add(k);
  }

  return Array.from(tokens).filter((t) => t && t.length > 0);
}

/**
 * Build một knowledge item từ raw + metadata.
 */
export function toKnowledgeItem(
  domain: KnowledgeItem['domain'],
  raw: KanjiWordRaw | VocabRaw | KanjiRadicalRaw | ReduplicativeRaw | Record<string, unknown>,
  meta: { id: string; level?: 'N2' | 'N3' | 'N4'; lessonNumber?: number },
): KnowledgeItem {
  const item: KnowledgeItem = {
    domain,
    id: meta.id,
    level: meta.level,
    lessonNumber: meta.lessonNumber,
    primary: extractPrimary(domain, raw),
    raw: raw as Record<string, unknown>,
    searchTokens: [],
  };
  item.searchTokens = buildSearchTokens(item);
  return item;
}

function extractPrimary(
  domain: KnowledgeItem['domain'],
  raw: unknown,
): string {
  const r = raw as Record<string, unknown>;
  switch (domain) {
    case 'kanji-word':
    case 'vocab':
      return String(r['kanji'] ?? '');
    case 'radical':
      return String(r['radical'] ?? '');
    case 'reduplicative':
      return String(r['japanese'] ?? '');
    case 'grammar':
      return String(r['pattern'] ?? r['meaning'] ?? r['japanese'] ?? '');
    default:
      return String(r['kanji'] ?? r['radical'] ?? r['japanese'] ?? '');
  }
}