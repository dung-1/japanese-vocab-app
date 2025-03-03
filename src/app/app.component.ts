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

  constructor(private http: HttpClient) {}

  onLessonSelected(lessonNumber: number) {
    this.http.get<any[]>(`assets/vocab-data/lesson${lessonNumber}.json`)
      .subscribe(data => {
        this.selectedLessonVocab = data;
      });
  }
}