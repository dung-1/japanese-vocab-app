import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false,
})
export class AppComponent  {
  selectedLessonVocab: any[] = [];

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object // Thêm để kiểm tra môi trường
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.preloadVocabData(); // Chỉ gọi preloadVocabData trên trình duyệt
    }
  }
  preloadVocabData() {
    if (!isPlatformBrowser(this.platformId)) {
      return; // Thoát nếu không phải trình duyệt
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
            this.selectedLessonVocab = []; // Dữ liệu mặc định nếu lỗi
          }
        });
      }
    } else {
      this.selectedLessonVocab = []; // Dữ liệu mặc định nếu không phải trình duyệt
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