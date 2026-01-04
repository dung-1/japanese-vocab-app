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
    // Preload data for lessons (assuming we'll have multiple lessons)
    for (let i = 1; i <= 10; i++) {
      const cachedData = localStorage.getItem(`reduplicative-lesson${i}`);
      if (!cachedData) {
        this.http.get<any[]>(`/assets/reduplicative-words-data/lesson${i}.json`).subscribe({
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
      const cachedData = localStorage.getItem(`reduplicative-lesson${lessonNumber}`);
      if (cachedData) {
        this.selectedLessonData = this.shuffleArray(JSON.parse(cachedData));
      } else {
        this.http.get<any[]>(`/assets/reduplicative-words-data/lesson${lessonNumber}.json`).subscribe({
          next: (data) => {
            this.selectedLessonData = this.shuffleArray([...data]);
            localStorage.setItem(`reduplicative-lesson${lessonNumber}`, JSON.stringify(data));
          },
          error: () => {
            this.selectedLessonData = [];
          }
        });
      }
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

