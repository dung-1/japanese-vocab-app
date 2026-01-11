import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-layout-kanji-words',
  standalone: false,
  templateUrl: './layout-kanji-words.component.html',
  styleUrl: './layout-kanji-words.component.css'
})
export class LayoutKanjiWordsComponent {
  selectedLessonVocab: any[] = [];
  studyMode: 'flashcard' | 'quiz' = 'flashcard';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.preloadVocabData();
    }
  }

  preloadVocabData() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    for (let i = 1; i <= 10; i++) {
      const cachedData = localStorage.getItem(`kanji-words-lesson${i}`);
      if (!cachedData) {
        this.http.get<any[]>(`assets/kanji-words-data/lesson${i}.json`).subscribe({
          next: (data) => {
            localStorage.setItem(`kanji-words-lesson${i}`, JSON.stringify(data));
          },
          error: (err) => console.error(`Lỗi tải kanji-words-lesson${i}:`, err)
        });
      }
    }
  }

  setStudyMode(mode: 'flashcard' | 'quiz') {
    this.studyMode = mode;
  }

  onLessonSelected(lessonNumber: number) {
    if (isPlatformBrowser(this.platformId)) {
      const cachedData = localStorage.getItem(`kanji-words-lesson${lessonNumber}`);
      if (cachedData) {
        this.selectedLessonVocab = this.shuffleArray(JSON.parse(cachedData));
      } else {
        this.http.get<any[]>(`assets/kanji-words-data/lesson${lessonNumber}.json`).subscribe({
          next: (data) => {
            this.selectedLessonVocab = this.shuffleArray([...data]);
            localStorage.setItem(`kanji-words-lesson${lessonNumber}`, JSON.stringify(data));
          },
          error: () => {
            this.selectedLessonVocab = [];
          }
        });
      }
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
