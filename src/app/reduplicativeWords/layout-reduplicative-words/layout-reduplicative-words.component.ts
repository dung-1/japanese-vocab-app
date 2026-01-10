import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-layout-reduplicative-words',
  standalone: false,
  templateUrl: './layout-reduplicative-words.component.html',
  styleUrl: './layout-reduplicative-words.component.css'
})
export class LayoutReduplicativeWordsComponent {
  selectedLessonData: any[] = [];
  studyMode: 'flashcard' | 'quiz' = 'flashcard';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.preloadData();
    }
  }

  preloadData() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Preload data for lessons in background (only if not cached)
    // Note: This is for initial load optimization, actual lesson selection always fetches fresh data
    for (let i = 1; i <= 10; i++) {
      const cachedData = localStorage.getItem(`reduplicative-lesson${i}`);
      if (!cachedData) {
        const cacheBuster = `?t=${Date.now()}`;
        this.http.get<any[]>(`assets/reduplicative-words-data/lesson${i}.json${cacheBuster}`).subscribe({
          next: (data) => {
            localStorage.setItem(`reduplicative-lesson${i}`, JSON.stringify(data));
          },
          error: (err) => console.error(`Lỗi tải reduplicative-lesson${i}:`, err)
        });
      }
    }
  }

  setStudyMode(mode: 'flashcard' | 'quiz') {
    this.studyMode = mode;
  }

  onLessonSelected(lessonNumber: number) {
    if (isPlatformBrowser(this.platformId)) {
      // Always fetch fresh data from HTTP to ensure latest updates
      // Use cache-busting timestamp to prevent browser HTTP cache
      const cacheBuster = `?t=${Date.now()}`;
      this.http.get<any[]>(`assets/reduplicative-words-data/lesson${lessonNumber}.json${cacheBuster}`).subscribe({
        next: (data) => {
          this.selectedLessonData = this.shuffleArray([...data]);
          // Update localStorage with fresh data
          localStorage.setItem(`reduplicative-lesson${lessonNumber}`, JSON.stringify(data));
        },
        error: () => {
          // Fallback to cached data if HTTP fetch fails
          const cachedData = localStorage.getItem(`reduplicative-lesson${lessonNumber}`);
          if (cachedData) {
            this.selectedLessonData = this.shuffleArray(JSON.parse(cachedData));
          } else {
            this.selectedLessonData = [];
          }
        }
      });
    } else {
      this.selectedLessonData = [];
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

