import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-layout-vocabulary',
  standalone: false,
  templateUrl: './layout-vocabulary.component.html',
  styleUrl: './layout-vocabulary.component.css'
})
export class LayoutVocabularyComponent {
  selectedLessonVocab: any[] = [];
  studyMode: 'flashcard' | 'quiz' = 'flashcard';
  private lessonRequestId = 0;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  setStudyMode(mode: 'flashcard' | 'quiz'): void {
    this.studyMode = mode;
  }

  onLessonSelected(selection: { level: string; lesson: number }): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.selectedLessonVocab = [];
      return;
    }

    const requestId = ++this.lessonRequestId;
    const cacheKey = `${selection.level}-lesson${selection.lesson}`;

    // localStorage can be unavailable or full in private/restricted browsing modes.
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        this.selectedLessonVocab = this.shuffleArray(JSON.parse(cachedData));
        return;
      }
    } catch (error) {
      console.warn('Không thể đọc cache từ vựng; sẽ tải dữ liệu trực tiếp.', error);
    }

    this.http.get<any[]>(`assets/vocab-data/${selection.level}/lesson${selection.lesson}.json`).subscribe({
      next: (data) => {
        // Ignore an older response if the user selected another lesson meanwhile.
        if (requestId !== this.lessonRequestId) {
          return;
        }

        this.selectedLessonVocab = this.shuffleArray([...data]);

        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (error) {
          console.warn('Không thể lưu cache từ vựng trên thiết bị này.', error);
        }
      },
      error: (error) => {
        if (requestId === this.lessonRequestId) {
          console.error('Không thể tải bài từ vựng:', error);
          this.selectedLessonVocab = [];
        }
      }
    });
  }

  private shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
