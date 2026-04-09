import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-layout-kanji-words',
  standalone: false,
  templateUrl: './layout-kanji-words.component.html',
  styleUrl: './layout-kanji-words.component.css',
})
export class LayoutKanjiWordsComponent {
  selectedLessonVocab: any[] = [];
  studyMode: 'flashcard' | 'quiz' = 'flashcard';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.preloadVocabData();
    }
  }

  preloadVocabData() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Preload data for N2 and N3 in background (only if not cached)
    const levels: { level: string; count: number }[] = [
      { level: 'N3', count: 30 },
      { level: 'N2', count: 2 },
      { level: 'N4', count: 26 },
    ];
    for (const { level, count } of levels) {
      for (let i = 1; i <= count; i++) {
        const cacheKey = `kanji-words-${level}-lesson${i}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (!cachedData) {
          const cacheBuster = `?t=${Date.now()}`;
          this.http
            .get<
              any[]
            >(`assets/kanji-words-data/${level}/lesson${i}.json${cacheBuster}`)
            .subscribe({
              next: (data) => {
                localStorage.setItem(cacheKey, JSON.stringify(data));
              },
              error: (err) => console.error(`Lỗi tải ${cacheKey}:`, err),
            });
        }
      }
    }
  }

  setStudyMode(mode: 'flashcard' | 'quiz') {
    this.studyMode = mode;
  }

  onLessonSelected(payload: { level: string; lessonNumber: number }) {
    const { level, lessonNumber } = payload;
    if (isPlatformBrowser(this.platformId)) {
      // Always fetch fresh data from HTTP to ensure latest updates
      // Use cache-busting timestamp to prevent browser HTTP cache
      const cacheBuster = `?t=${Date.now()}`;
      const cacheKey = `kanji-words-${level}-lesson${lessonNumber}`;
      this.http
        .get<
          any[]
        >(`assets/kanji-words-data/${level}/lesson${lessonNumber}.json${cacheBuster}`)
        .subscribe({
          next: (data) => {
            this.selectedLessonVocab = this.shuffleArray([...data]);
            // Update localStorage with fresh data
            localStorage.setItem(cacheKey, JSON.stringify(data));
          },
          error: () => {
            // Fallback to cached data if HTTP fetch fails
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
              this.selectedLessonVocab = this.shuffleArray(
                JSON.parse(cachedData),
              );
            } else {
              this.selectedLessonVocab = [];
            }
          },
        });
    } else {
      this.selectedLessonVocab = [];
    }
  }

  private shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
