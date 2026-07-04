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
   * Chiến lược: Ưu tiên Keyword Match (Exact) > Semantic Match > Keyword Match (Fuzzy).
   */
  async search(query: string, items: KnowledgeItem[], topK = 5): Promise<SearchHit[]> {
    if (!query || !items || items.length === 0) return [];
    
    // 1. Keyword search - Luôn chạy để đảm bảo độ chính xác tuyệt đối
    const keywordHits = this.keywordSearch(query, items);

    // 2. Semantic search - Hỗ trợ tìm kiếm theo ý nghĩa
    const semanticHits = await this.semanticSearch(query, items);

    // 3. Merge kết quả
    // Tạo Map để deduplicate dựa trên item.id
    const finalMap = new Map<string, SearchHit>();

    // Thêm Keyword hits trước
    for (const hit of keywordHits) {
      finalMap.set(hit.item.id, hit);
    }

    // Thêm Semantic hits: chỉ ghi đè nếu score semantic vượt trội 
    // hoặc nếu keyword chưa tìm thấy (để tránh semantic làm nhiễu exact match)
    for (const sHit of semanticHits) {
      const existing = finalMap.get(sHit.item.id);
      if (!existing || sHit.score > (existing.score + 1)) { 
        // Chỉ ghi đè nếu score semantic cao hơn đáng kể hoặc chưa có
        finalMap.set(sHit.item.id, sHit);
      }
    }

    const sorted = Array.from(finalMap.values()).sort((a, b) => b.score - a.score);
    
    // Debug log để theo dõi tại sao mất dữ liệu
    console.log(`[SearchEngine] Query: "${query}" | Keyword Hits: ${keywordHits.length} | Semantic Hits: ${semanticHits.length} | Final: ${sorted.length}`);
    
    return sorted.slice(0, topK);
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
