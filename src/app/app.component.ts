import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: false,
})
export class AppComponent  {
  selectedLessonVocab: any[] = [];

  constructor(private http: HttpClient) {
    this.preloadVocabData();
  }
  preloadVocabData() {
    // Giả sử bạn có 50 bài học
    for (let i = 1; i <= 50; i++) {
      const cachedData = localStorage.getItem(`lesson${i}`);
      if (!cachedData) {
        this.http.get<any[]>(`assets/vocab-data/lesson${i}.json`).subscribe(data => {
          localStorage.setItem(`lesson${i}`, JSON.stringify(data));
        });
      }
    }
  }

  onLessonSelected(lessonNumber: number) {
    const cachedData = localStorage.getItem(`lesson${lessonNumber}`);
    if (cachedData) {
      this.selectedLessonVocab = this.shuffleArray(JSON.parse(cachedData));
    } else {
      this.http.get<any[]>(`assets/vocab-data/lesson${lessonNumber}.json`).subscribe(data => {
        this.selectedLessonVocab = this.shuffleArray([...data]);
        localStorage.setItem(`lesson${lessonNumber}`, JSON.stringify(data));
      });
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