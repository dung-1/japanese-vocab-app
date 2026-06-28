/**
 * Placeholder romanize util. Phase 1 chưa cần Wanakana.
 * Nếu sau này cần chuyển Hiragana <-> Romaji, có thể bổ sung ở đây.
 */
export function romanize(_input: string): string {
  return _input;
}

export function isRomaji(input: string): boolean {
  return /^[a-zA-Z\s.\-']+$/.test(input);
}