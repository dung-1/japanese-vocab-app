import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GrammarItem, GrammarQuizQuestion, GrammarQuizResult } from '../models/grammar.model';

export interface GrammarLevelConfig {
  level: string;
  lessons: number;
  startLesson: number;
}

const LEVEL_CONFIG: GrammarLevelConfig[] = [
  { level: 'N5', lessons: 5, startLesson: 1 },
  { level: 'N4', lessons: 8, startLesson: 1 },
  { level: 'N3', lessons: 30, startLesson: 1 },
];

@Injectable({ providedIn: 'root' })
export class GrammarService {
  readonly levels: GrammarLevelConfig[] = LEVEL_CONFIG;

  private statsKey = 'grammar-stats';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  // ─── Data Loading ─────────────────────────────────────────────────────────

  preloadAll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.levels.forEach(({ level, lessons, startLesson }) => {
      for (let i = startLesson; i < startLesson + lessons; i++) {
        const key = this.cacheKey(level, i);
        if (!localStorage.getItem(key)) {
          this.http
            .get<GrammarItem[]>(`assets/grammar/${level}/lesson${i}.json`)
            .subscribe({
              next: (data) => localStorage.setItem(key, JSON.stringify(data)),
              error: () => { /* file chưa có — bỏ qua */ },
            });
        }
      }
    });
  }

  loadLesson(level: string, lesson: number): Promise<GrammarItem[]> {
    return new Promise((resolve) => {
      if (!isPlatformBrowser(this.platformId)) { resolve([]); return; }

      const key = this.cacheKey(level, lesson);
      const cached = localStorage.getItem(key);
      if (cached) { resolve(this.shuffle(JSON.parse(cached))); return; }

      this.http
        .get<GrammarItem[]>(`assets/grammar/${level}/lesson${lesson}.json`)
        .subscribe({
          next: (data) => {
            localStorage.setItem(key, JSON.stringify(data));
            resolve(this.shuffle([...data]));
          },
          error: () => resolve([]),
        });
    });
  }

  // ─── Quiz Generation ──────────────────────────────────────────────────────

  generateQuiz(items: GrammarItem[], count: number): GrammarQuizQuestion[] {
    const pool = this.shuffle([...items]).slice(0, count);
    const types: GrammarQuizQuestion['type'][] = [
      'meaning-to-pattern',
      'pattern-to-meaning',
      'formula-check',
      'example-match',
      'fill-blank',
    ];

    return pool.map((item, i) => {
      const type = types[i % types.length];
      return this.buildQuestion(item, type, items);
    });
  }

  private buildQuestion(
    item: GrammarItem,
    type: GrammarQuizQuestion['type'],
    allItems: GrammarItem[]
  ): GrammarQuizQuestion {
    const distractors = this.getDistractors(item, allItems);

    switch (type) {
      case 'meaning-to-pattern': {
        const options = this.shuffle([item.pattern, ...distractors.map(d => d.pattern)]);
        return {
          id: `${item.id}-mp`,
          type,
          question: `"${item.meaning}" tương ứng với mẫu ngữ pháp nào?`,
          correctAnswer: item.pattern,
          options,
          grammarItem: item,
        };
      }
      case 'pattern-to-meaning': {
        const options = this.shuffle([item.meaning, ...distractors.map(d => d.meaning)]);
        return {
          id: `${item.id}-pm`,
          type,
          question: `Mẫu ngữ pháp "${item.pattern}" có nghĩa là gì?`,
          correctAnswer: item.meaning,
          options,
          grammarItem: item,
        };
      }
      case 'formula-check': {
        const options = this.shuffle([item.connection.formula, ...distractors.map(d => d.connection.formula)]);
        return {
          id: `${item.id}-fc`,
          type,
          question: `Cách nối "${item.pattern}" vào câu là gì?`,
          correctAnswer: item.connection.formula,
          options,
          grammarItem: item,
        };
      }
      case 'example-match': {
        const example = item.examples[0];
        const options = this.shuffle([item.pattern, ...distractors.map(d => d.pattern)]);
        return {
          id: `${item.id}-em`,
          type,
          question: `Câu "${example.english}" dùng mẫu ngữ pháp nào?`,
          correctAnswer: item.pattern,
          options,
          grammarItem: item,
        };
      }
      case 'fill-blank': {
        const example = item.examples[0] ?? { japanese: item.pattern, reading: '', english: '' };
        const blanked = example.japanese.replace(item.pattern, '___');
        const options = this.shuffle([item.pattern, ...distractors.map(d => d.pattern)]);
        return {
          id: `${item.id}-fb`,
          type,
          question: `Điền vào chỗ trống: "${blanked}"`,
          correctAnswer: item.pattern,
          options,
          grammarItem: item,
        };
      }
    }
  }

  private getDistractors(item: GrammarItem, allItems: GrammarItem[]): GrammarItem[] {
    return this.shuffle(allItems.filter(i => i.id !== item.id)).slice(0, 3);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  saveQuizResult(level: string, lesson: number, results: GrammarQuizResult[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const correct = results.filter(r => r.isCorrect).length;
    const score = Math.round((correct / results.length) * 100);
    const stats = this.loadStats();
    const key = `${level}-${lesson}`;
    const prev = stats[key];
    stats[key] = {
      level,
      lesson,
      lastScore: score,
      bestScore: prev ? Math.max(prev.bestScore, score) : score,
      attempts: prev ? prev.attempts + 1 : 1,
      lastDate: new Date().toISOString(),
    };
    localStorage.setItem(this.statsKey, JSON.stringify(stats));
  }

  loadStats(): Record<string, any> {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      return JSON.parse(localStorage.getItem(this.statsKey) ?? '{}');
    } catch { return {}; }
  }

  getOverallStats(): { totalLessons: number; avgScore: number; totalAttempts: number } {
    const stats = this.loadStats();
    const entries = Object.values(stats) as any[];
    if (!entries.length) return { totalLessons: 0, avgScore: 0, totalAttempts: 0 };
    const avgScore = Math.round(entries.reduce((s, e) => s + e.lastScore, 0) / entries.length);
    return {
      totalLessons: entries.length,
      avgScore,
      totalAttempts: entries.reduce((s, e) => s + e.attempts, 0),
    };
  }

  // ─── Util ─────────────────────────────────────────────────────────────────

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private cacheKey(level: string, lesson: number): string {
    return `grammar-${level}-lesson${lesson}`;
  }
}
