import { Component ,Inject, OnInit, PLATFORM_ID } from '@angular/core';
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
    for (let i = 1; i <= 50; i++) {
      const cachedData = localStorage.getItem(`lesson${i}`);
      if (!cachedData) {
        this.http.get<any[]>(`/assets/vocab-data/lesson${i}.json`).subscribe({
          next: (data) => {
            localStorage.setItem(`lesson${i}`, JSON.stringify(data));
          },
          error: (err) => console.error(`Lỗi tải lesson${i}:`, err)
        });
      }
    }
  }

  onLessonSelected(lessonNumber: number) {
    if (isPlatformBrowser(this.platformId)) {
      const cachedData = localStorage.getItem(`lesson${lessonNumber}`);
      if (cachedData) {
        this.selectedLessonVocab = this.shuffleArray(JSON.parse(cachedData));
      } else {
        this.http.get<any[]>(`/assets/vocab-data/lesson${lessonNumber}.json`).subscribe({
          next: (data) => {
            this.selectedLessonVocab = this.shuffleArray([...data]);
            localStorage.setItem(`lesson${lessonNumber}`, JSON.stringify(data));
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
