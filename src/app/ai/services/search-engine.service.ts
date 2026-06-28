import { Injectable } from '@angular/core';
import { KnowledgeDomain, KnowledgeItem } from '../models/knowledge.model';
import { compositeScore, jaccard } from '../utils/text-similarity.util';
import { extractKanji } from '../utils/tokenizer.util';
import { normalizeQuery, normalizeVi } from '../utils/string-normalize.util';

export interface SearchHit {
  item: KnowledgeItem;
  score: number;
  matchedToken?: string;
}

@Injectable({ providedIn: 'root' })
export class SearchEngineService {
  /**
   * Tìm kiếm trong 1 danh sách item.
   * @param query câu hỏi / từ khoá
   * @param items danh sách candidate
   * @param topK số kết quả tối đa
   */
  search(query: string, items: KnowledgeItem[], topK = 5): SearchHit[] {
    if (!query || !items || items.length === 0) return [];
    const normalizedQ = normalizeQuery(query).toLowerCase();
    const qKanji = extractKanji(query);
    const qTokens = normalizedQ.split(' ').filter(Boolean);
    const hits: SearchHit[] = [];

    for (const item of items) {
      const { score, matchedToken } = this.scoreItem(item, normalizedQ, qTokens, qKanji);
      if (score > 0) {
        hits.push({ item, score, matchedToken });
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  private scoreItem(
    item: KnowledgeItem,
    normalizedQ: string,
    qTokens: string[],
    qKanji: string[],
  ): { score: number; matchedToken?: string } {
    let best = 0;
    let matchedToken: string | undefined;

    // 1) Exact primary match → score cao nhất
    const primaryLower = (item.primary ?? '').toLowerCase();
    if (primaryLower && normalizedQ.includes(primaryLower)) {
      const exact = 5 + (primaryLower.length / Math.max(normalizedQ.length, 1)) * 2;
      if (exact > best) {
        best = exact;
        matchedToken = item.primary;
      }
    }

    // 2) Kanji chars overlap
    const itemKanji = new Set(extractKanji(item.primary ?? ''));
    let kanjiOverlap = 0;
    for (const k of qKanji) if (itemKanji.has(k)) kanjiOverlap++;
    if (kanjiOverlap > 0) {
      const kScore = 3 + kanjiOverlap * 2;
      if (kScore > best) {
        best = kScore;
        matchedToken = Array.from(itemKanji).find((k) => qKanji.includes(k)) ?? matchedToken;
      }
    }

    // 3) Scan searchTokens
    for (const token of item.searchTokens) {
      if (!token) continue;
      const tokenLower = token.toLowerCase();

      // exact match
      if (tokenLower === normalizedQ) {
        if (5 > best) {
          best = 5;
          matchedToken = token;
        }
      }

      // token in query (haystack smaller)
      if (tokenLower.length >= 2 && normalizedQ.includes(tokenLower)) {
        const s = compositeScore(normalizedQ, tokenLower);
        if (s > best) {
          best = s;
          matchedToken = token;
        }
      }

      // query token in token
      for (const qt of qTokens) {
        if (qt.length < 2) continue;
        if (tokenLower.includes(qt)) {
          const s = jaccard(qt, tokenLower) + 0.5;
          if (s > best) {
            best = s;
            matchedToken = token;
          }
        }
      }
    }

    // 4) Raw meaning/nghia text
    const raw = item.raw as Record<string, unknown>;
    const meaning = String(raw['meaning'] ?? raw['nghia'] ?? raw['vietnamese'] ?? '');
    if (meaning) {
      const m = compositeScore(normalizedQ, normalizeVi(meaning));
      if (m > best) {
        best = m;
        matchedToken = 'meaning';
      }
    }

    return { score: best, matchedToken };
  }

  /**
   * Domain detection từ query. Trả về domain phù hợp nhất.
   */
  detectDomain(query: string): KnowledgeDomain {
    const q = query.toLowerCase();
    if (/(bộ thủ|bo thu|radical|部首|ブシュ)/.test(q)) return 'radical';
    if (/(ngữ pháp|grammar|文型|ぶんけい|～たら|～ば|～と|～ので|～ながら)/.test(q)) return 'grammar';
    if (/(từ vựng|tu vung|vocab|hiragana|romaji|ローマ字|ひらがな)/.test(q)) return 'vocab';
    if (/(từ láy|reduplicative|gitaigo|擬態語|擬声語)/.test(q)) return 'reduplicative';
    // Default: kanji-word vì là dữ liệu lớn nhất
    return 'kanji-word';
  }
}