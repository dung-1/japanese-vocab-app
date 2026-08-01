import { Injectable, inject } from '@angular/core';
import { KnowledgeDomain, KnowledgeItem } from '../models/knowledge.model';
import { compositeScore, jaccard } from '../utils/text-similarity.util';
import { extractKanji } from '../utils/tokenizer.util';
import { normalizeQuery, normalizeVi } from '../utils/string-normalize.util';
import { VectorMath } from '../utils/vector-math.util';
import { EmbeddingService } from './embedding.service';

export interface SearchHit {
  item: KnowledgeItem;
  score: number;
  matchedToken?: string;
  isSemantic?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SearchEngineService {
  private readonly embeddingSvc = inject(EmbeddingService);

  /**
   * Tìm kiếm kết hợp Keyword và Semantic.
   * Nếu query chỉ rõ bài/level (ví dụ "bài 1 N3"), ưu tiên items đó trước.
   */
  async search(query: string, items: KnowledgeItem[], topK = 5): Promise<SearchHit[]> {
    if (!query || !items || items.length === 0) return [];

    // Trích xuất lesson/level từ query nếu user chỉ định
    const lessonHint  = this.extractLessonHint(query);
    const levelHint   = this.extractLevelHint(query);

    // 1. Keyword search
    const keywordHits = this.keywordSearch(query, items);

    // 2. Semantic search
    const semanticHits = await this.semanticSearch(query, items);

    // 3. Merge
    const finalMap = new Map<string, SearchHit>();
    for (const hit of keywordHits)  finalMap.set(hit.item.id, hit);
    for (const sHit of semanticHits) {
      const existing = finalMap.get(sHit.item.id);
      if (!existing || sHit.score > (existing.score + 1)) {
        finalMap.set(sHit.item.id, sHit);
      }
    }

    // 4. Boost items khớp lesson + level hint
    if (lessonHint !== null || levelHint !== null) {
      for (const hit of finalMap.values()) {
        let boost = 0;
        if (lessonHint !== null && hit.item.lessonNumber === lessonHint) boost += 3;
        if (levelHint  !== null && hit.item.level        === levelHint)  boost += 2;
        if (boost > 0) hit.score += boost;
      }
    }

    const sorted = Array.from(finalMap.values()).sort((a, b) => b.score - a.score);
    console.log(`[SearchEngine] "${query}" | kw:${keywordHits.length} sem:${semanticHits.length} final:${sorted.length} lesson:${lessonHint} level:${levelHint}`);
    return sorted.slice(0, topK);
  }

  /** Đọc số bài từ query, ví dụ "bài 1" -> 1 */
  private extractLessonHint(query: string): number | null {
    const m = query.match(/b[aài]+\s*(\d+)/i) ?? query.match(/lesson\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  /** Đọc level từ query, ví dụ "N3" -> 'N3' */
  private extractLevelHint(query: string): 'N2' | 'N3' | 'N4' | null {
    const m = query.match(/\bN([234])\b/);
    if (!m) return null;
    return `N${m[1]}` as 'N2' | 'N3' | 'N4';
  }

  private keywordSearch(query: string, items: KnowledgeItem[]): SearchHit[] {
    const normalizedQ = normalizeQuery(query).toLowerCase();
    const qKanji = extractKanji(query);
    const qTokens = normalizedQ.split(' ').filter(Boolean);
    const hits: SearchHit[] = [];

    for (const item of items) {
      const { score, matchedToken } = this.scoreItemKeyword(item, normalizedQ, qTokens, qKanji);
      if (score > 0) {
        hits.push({ item, score, matchedToken, isSemantic: false });
      }
    }
    return hits;
  }

  private async semanticSearch(query: string, items: KnowledgeItem[]): Promise<SearchHit[]> {
    try {
      const qVector = await this.embeddingSvc.getEmbedding(query);
      const hits: SearchHit[] = [];

      for (const item of items) {
        const itemVector = this.embeddingSvc.getVector(item.id);
        if (!itemVector) continue;

        const similarity = VectorMath.cosineSimilarity(qVector, itemVector);
        
        if (similarity > 0.6) {
          // Scale score: 0.6 -> 3.0, 1.0 -> 5.0
          const scaledScore = similarity * 5; 
          hits.push({ item, score: scaledScore, matchedToken: 'semantic', isSemantic: true });
        }
      }
      return hits;
    } catch (e) {
      console.error('[SearchEngineService.semanticSearch] failed:', e);
      return [];
    }
  }

  private scoreItemKeyword(
    item: KnowledgeItem,
    normalizedQ: string,
    qTokens: string[],
    qKanji: string[],
  ): { score: number; matchedToken?: string } {
    let best = 0;
    let matchedToken: string | undefined;

    const primaryLower = (item.primary ?? '').toLowerCase();
    if (primaryLower && normalizedQ.includes(primaryLower)) {
      const exact = 5 + (primaryLower.length / Math.max(normalizedQ.length, 1)) * 2;
      if (exact > best) {
        best = exact;
        matchedToken = item.primary;
      }
    }

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

    for (const token of item.searchTokens) {
      if (!token) continue;
      const tokenLower = token.toLowerCase();
      if (tokenLower === normalizedQ) {
        if (5 > best) {
          best = 5;
          matchedToken = token;
        }
      }
      if (tokenLower.length >= 2 && normalizedQ.includes(tokenLower)) {
        const s = compositeScore(normalizedQ, tokenLower);
        if (s > best) {
          best = s;
          matchedToken = token;
        }
      }
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

  detectDomain(query: string): KnowledgeDomain {
    const q = query.toLowerCase();
    if (/(bộ thủ|bo thu|radical|部首|ブシュ)/.test(q)) return 'radical';
    if (/(ngữ pháp|grammar|文型|ぶんけい|～たら|～ば|～と|～ので|～ながら)/.test(q)) return 'grammar';
    if (/(từ vựng|tu vung|vocab|hiragana|romaji|ローマ字|ひらがな)/.test(q)) return 'vocab';
    if (/(từ láy|reduplicative|gitaigo|擬態語|擬声語)/.test(q)) return 'reduplicative';
    return 'kanji-word';
  }
}
