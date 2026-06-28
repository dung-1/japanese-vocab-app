export type KnowledgeDomain =
  | 'kanji-word'
  | 'vocab'
  | 'radical'
  | 'reduplicative'
  | 'grammar';

export const KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  'kanji-word',
  'vocab',
  'radical',
  'reduplicative',
  'grammar',
];

export interface KanjiWordRaw {
  kanji: string;
  amHan: string;
  nghia: string;
  onyomi: string;
  kunyomi: string;
  mnemonic?: { text: string };
  examples: Array<{ word: string; reading: string; meaning: string }>;
}

export interface VocabRaw {
  kanji: string;
  hiragana: string;
  hanViet: string;
  meaning: string;
}

export interface KanjiRadicalRaw {
  radical: string;
  meaning: string;
  strokeCount: number;
  exampleKanji: string[];
  memoryTrick: string;
  pronunciations: string[];
  explanation: string;
}

export interface ReduplicativeRaw {
  japanese: string;
  romaji: string;
  vietnamese: string;
  category: string;
}

export interface KnowledgeItem {
  domain: KnowledgeDomain;
  id: string;
  level?: 'N2' | 'N3' | 'N4';
  lessonNumber?: number;
  primary: string;
  raw: KanjiWordRaw | VocabRaw | KanjiRadicalRaw | ReduplicativeRaw | Record<string, unknown>;
  searchTokens: string[];
}

export interface KnowledgeManifestFile {
  domain: KnowledgeDomain;
  level?: 'N2' | 'N3' | 'N4';
  path: string;
}

export interface KnowledgeManifest {
  files: KnowledgeManifestFile[];
}

export interface KnowledgeIndex {
  byDomain: Record<KnowledgeDomain, KnowledgeItem[]>;
  byToken: Map<string, KnowledgeItem[]>;
  loaded: boolean;
}