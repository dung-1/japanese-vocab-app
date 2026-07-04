import { Injectable, inject, signal } from '@angular/core';
import { ProviderFactory } from '../providers/provider-factory.service';
import { EmbeddingVector } from '../models/embedding.model';
import { KnowledgeItem } from '../models/knowledge.model';

@Injectable({ providedIn: 'root' })
export class EmbeddingService {
  private providerFactory = inject(ProviderFactory);
  private cache = new Map<string, EmbeddingVector>();
  private isInitializing = signal(false);
  private isReady = signal(false);

  readonly isVectorizing = this.isInitializing.asReadonly();
  readonly embeddingsReady = this.isReady.asReadonly();

  async getEmbedding(text: string): Promise<EmbeddingVector> {
    const provider = this.providerFactory.getProvider();
    if (!provider || !provider.embed) {
      throw new Error('Current provider does not support embeddings.');
    }
    return await provider.embed(text);
  }

  async getOrCreateEmbedding(itemId: string, text: string): Promise<EmbeddingVector> {
    if (this.cache.has(itemId)) {
      return this.cache.get(itemId)!;
    }
    const vector = await this.getEmbedding(text);
    this.cache.set(itemId, vector);
    return vector;
  }

  async vectorizeKnowledgeBase(items: KnowledgeItem[]): Promise<void> {
    if (this.isInitializing()) return;
    this.isInitializing.set(true);

    console.log(`[EmbeddingService] Starting vectorization for ${items.length} items...`);
    
    try {
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
          const contentToEmbed = this.prepareContentForEmbedding(item);
          const vector = await this.getEmbedding(contentToEmbed);
          this.cache.set(item.id, vector);
        }));
        
        if (i % 50 === 0) {
          console.log(`[EmbeddingService] Vectorized ${i}/${items.length} items...`);
        }
      }
      console.log('[EmbeddingService] Knowledge base vectorization complete.');
      this.isReady.set(true);
    } catch (e) {
      console.error('[EmbeddingService] Vectorization failed:', e);
      throw e;
    } finally {
      this.isInitializing.set(false);
    }
  }

  private prepareContentForEmbedding(item: KnowledgeItem): string {
    const primary = item.primary;
    const raw = item.raw as any;
    
    const meaning = raw.meaning || raw.nghia || raw.vietnamese || '';
    const reading = raw.amHan || raw.hiragana || raw.romaji || '';
    const example = raw.example || (Array.isArray(raw.examples) ? raw.examples[0]?.word : '');
    const note = raw.note || raw.memoryTrick || raw.explanation || '';

    const parts = [
      primary,
      meaning,
      reading,
      example,
      note
    ].filter(p => !!p);
    
    return parts.join(' | ');
  }

  getVector(itemId: string): EmbeddingVector | undefined {
    return this.cache.get(itemId);
  }

  clearCache(): void {
    this.cache.clear();
    this.isReady.set(false);
  }
}
