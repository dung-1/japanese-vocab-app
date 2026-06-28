/**
 * Detect xem một ký tự có phải Kanji (CJK) hay không.
 */
export function isKanji(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

/**
 * Detect Hiragana.
 */
export function isHiragana(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x3040 && code <= 0x309f;
}

/**
 * Detect Katakana.
 */
export function isKatakana(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 0x30a0 && code <= 0x30ff;
}

/**
 * Phân loại một ký tự thành loại.
 */
export type CharKind = 'kanji' | 'hiragana' | 'katakana' | 'latin' | 'digit' | 'punct' | 'other';

export function classifyChar(ch: string): CharKind {
  if (isKanji(ch)) return 'kanji';
  if (isHiragana(ch)) return 'hiragana';
  if (isKatakana(ch)) return 'katakana';
  const code = ch.charCodeAt(0);
  if (code >= 0x30 && code <= 0x39) return 'digit';
  if (/[a-zA-Z]/.test(ch)) return 'latin';
  if (/[\s\u2000-\u206f]/.test(ch)) return 'punct';
  return 'other';
}

/**
 * Tách câu tiếng Nhật thành các nhóm: kanji-run, kana-run, latin-run.
 */
export function splitRuns(input: string): Array<{ kind: CharKind; text: string }> {
  if (!input) return [];
  const runs: Array<{ kind: CharKind; text: string }> = [];
  let current: { kind: CharKind; text: string } | null = null;

  for (const ch of input) {
    const kind = classifyChar(ch);
    if (kind === 'punct' || kind === 'other') continue;
    if (current && current.kind === kind) {
      current.text += ch;
    } else {
      if (current) runs.push(current);
      current = { kind, text: ch };
    }
  }
  if (current) runs.push(current);
  return runs;
}

/**
 * Trích riêng các Kanji trong câu (loại bỏ trùng).
 */
export function extractKanji(input: string): string[] {
  if (!input) return [];
  const set = new Set<string>();
  for (const ch of input) {
    if (isKanji(ch)) set.add(ch);
  }
  return Array.from(set);
}