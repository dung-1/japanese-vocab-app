import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  KNOWLEDGE_DOMAINS,
  KanjiRadicalRaw,
  KanjiWordRaw,
  KnowledgeDomain,
  KnowledgeIndex,
  KnowledgeItem,
  KnowledgeManifest,
  ReduplicativeRaw,
  VocabRaw,
} from '../models/knowledge.model';
import { toKnowledgeItem } from '../utils/item-builder.util';

interface ManifestRule {
  domain: KnowledgeDomain;
  level?: 'N2' | 'N3' | 'N4';
  pathTemplate: string; // e.g. "assets/kanji-words-data/N3/lesson{1-30}.json"
}

const HARDCODED_RULES: ManifestRule[] = [
  { domain: 'kanji-word', level: 'N3', pathTemplate: 'assets/kanji-words-data/N3/lesson{1-30}.json' },
  { domain: 'kanji-word', level: 'N4', pathTemplate: 'assets/kanji-words-data/N4/lesson{1-26}.json' },
  { domain: 'kanji-word', level: 'N2', pathTemplate: 'assets/kanji-words-data/N2/lesson{1-48}.json' },
  { domain: 'vocab', level: 'N3', pathTemplate: 'assets/vocab-data/N3/lesson{1-22}.json' },
  { domain: 'vocab', level: 'N4', pathTemplate: 'assets/vocab-data/N4/lesson{1-25}.json' },
  { domain: 'radical', pathTemplate: 'assets/kanji-radicard-data/lesson{1-17}.json' },
  { domain: 'reduplicative', pathTemplate: 'assets/reduplicative-words-data/lesson{1-10}.json' },
];

@Injectable({ providedIn: 'root' })
export class KnowledgeService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly index = signal<KnowledgeIndex>(this.emptyIndex());
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly progress = signal<string>('');

  private loadPromise: Promise<KnowledgeIndex> | null = null;

  /**
   * Load toàn bộ JSON một lần. Idempotent.
   * Trong SSR/prerender sẽ trả về empty index (load diễn ra ở browser).
   */
  async loadAll(force = false): Promise<KnowledgeIndex> {
    if (!isPlatformBrowser(this.platformId)) {
      // SSR/prerender: không tải JSON, trả empty index.
      return this.emptyIndex();
    }
    if (!force && this.loadPromise) return this.loadPromise;
    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<KnowledgeIndex> {
    this.loading.set(true);
    this.loadError.set(null);
    this.progress.set('Đang tải dữ liệu...');

    const index = this.emptyIndex();
    const errors: string[] = [];

    for (const rule of HARDCODED_RULES) {
      const urls = expandTemplate(rule.pathTemplate);
      for (const url of urls) {
        try {
          const data = await firstValueFrom(this.http.get<unknown[]>(url, { responseType: 'json' }));
          if (!Array.isArray(data)) continue;
          for (let i = 0; i < data.length; i++) {
            const raw = data[i] as Record<string, unknown>;
            const item = this.buildItem(rule.domain, raw as unknown, {
              level: rule.level,
              fileUrl: url,
              index: i,
            });
            if (item) {
              index.byDomain[rule.domain].push(item);
              for (const tok of item.searchTokens) {
                const list = index.byToken.get(tok) ?? [];
                list.push(item);
                index.byToken.set(tok, list);
              }
            }
          }
          this.progress.set(`Đã tải ${url} (${data.length} mục)`);
        } catch (err) {
          errors.push(`${url}: ${(err as Error).message ?? err}`);
        }
      }
    }

    index.loaded = true;
    this.index.set(index);
    this.loaded.set(true);
    this.loading.set(false);
    this.progress.set(`Hoàn tất. ${this.countItems(index)} mục trong ${errors.length} lỗi.`);
    if (errors.length > 0) this.loadError.set(errors.join('\n'));

    return index;
  }

  private buildItem(
    domain: KnowledgeDomain,
    raw: unknown,
    meta: { level?: 'N2' | 'N3' | 'N4'; fileUrl: string; index: number },
  ): KnowledgeItem | null {
    const id = `${domain}:${meta.level ?? 'x'}:${meta.fileUrl.split('/').pop()}:${meta.index}`;
    try {
      switch (domain) {
        case 'kanji-word':
          return toKnowledgeItem('kanji-word', raw as unknown as KanjiWordRaw, {
            id,
            level: meta.level,
          });
        case 'vocab':
          return toKnowledgeItem('vocab', raw as unknown as VocabRaw, {
            id,
            level: meta.level,
          });
        case 'radical':
          return toKnowledgeItem('radical', raw as unknown as KanjiRadicalRaw, { id });
        case 'reduplicative':
          return toKnowledgeItem('reduplicative', raw as unknown as ReduplicativeRaw, { id });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private countItems(idx: KnowledgeIndex): number {
    return KNOWLEDGE_DOMAINS.reduce((acc, d) => acc + idx.byDomain[d].length, 0);
  }

  private emptyIndex(): KnowledgeIndex {
    const byDomain: Record<KnowledgeDomain, KnowledgeItem[]> = {
      'kanji-word': [],
      vocab: [],
      radical: [],
      reduplicative: [],
      grammar: [],
    };
    return {
      byDomain,
      byToken: new Map(),
      loaded: false,
    };
  }

  /**
   * Public accessor cho SearchEngineService sử dụng.
   */
  getItemsByDomain(domain: KnowledgeDomain): KnowledgeItem[] {
    return this.index().byDomain[domain] ?? [];
  }

  /**
   * Optional: load manifest.json từ assets/ai/manifest.json để dynamic rules (Phase 2).
   */
  async loadManifest(): Promise<KnowledgeManifest | null> {
    try {
      const m = await firstValueFrom(
        this.http.get<KnowledgeManifest>('assets/ai/manifest.json', { responseType: 'json' }),
      );
      return m;
    } catch {
      return null;
    }
  }
}

function expandTemplate(template: string): string[] {
  const match = template.match(/^(.+)\{(\d+)-(\d+)\}(.+)$/);
  if (!match) return [template];
  const [, prefix, startStr, endStr, suffix] = match;
  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  const urls: string[] = [];
  for (let i = start; i <= end; i++) {
    urls.push(`${prefix}${i}${suffix}`);
  }
  return urls;
}