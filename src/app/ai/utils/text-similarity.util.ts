import { normalizeVi } from './string-normalize.util';

/**
 * Jaccard similarity trên 2 tập tokens.
 */
export function jaccard(a: string, b: string): number {
  const A = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let intersect = 0;
  A.forEach((x) => {
    if (B.has(x)) intersect++;
  });
  const union = A.size + B.size - intersect;
  return intersect / union;
}

/**
 * Đếm substring match (case-insensitive, đã normalize tiếng Việt).
 */
export function substringScore(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;
  const a = normalizeVi(needle);
  const b = normalizeVi(haystack);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.includes(a)) return Math.min(1, a.length / b.length + 0.3);
  return 0;
}

/**
 * Levenshtein đơn giản (cho typo tolerance).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Tính điểm tổng hợp: jaccard + substring + char-overlap.
 */
export function compositeScore(query: string, candidate: string): number {
  const j = jaccard(query, candidate);
  const s = substringScore(query, candidate);
  const lenRatio = Math.min(query.length, candidate.length) / Math.max(query.length, candidate.length, 1);
  return j * 0.5 + s * 0.4 + lenRatio * 0.1;
}