import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { CatholicQuestion } from '../models/catholic.model';

@Component({ selector: 'app-layout-catholic', standalone: false, templateUrl: './layout-catholic.component.html', styleUrl: './layout-catholic.component.css' })
export class LayoutCatholicComponent {
  selectedLesson: CatholicQuestion[] = [];
  selectedLessonNumber: number | null = null;
  studyMode: 'flashcard' | 'quiz' = 'flashcard';
  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) { if (isPlatformBrowser(platformId)) this.preloadData(); }
  setStudyMode(mode: 'flashcard' | 'quiz') { this.studyMode = mode; }
  onLessonSelected(lesson: number) {
    this.selectedLessonNumber = lesson;
    const key = `catholic-lesson${lesson}`;
    const cached = isPlatformBrowser(this.platformId) ? localStorage.getItem(key) : null;
    if (cached) { this.selectedLesson = this.shuffle(JSON.parse(cached)); return; }
    this.http.get<CatholicQuestion[]>(`assets/catholic-data/lesson${lesson}.json`).subscribe({ next: data => { this.selectedLesson = this.shuffle(data); if (isPlatformBrowser(this.platformId)) localStorage.setItem(key, JSON.stringify(data)); }, error: () => this.selectedLesson = [] });
  }
  private preloadData() { for (let lesson = 1; lesson <= 19; lesson++) this.http.get<CatholicQuestion[]>(`assets/catholic-data/lesson${lesson}.json`).subscribe({ next: data => localStorage.setItem(`catholic-lesson${lesson}`, JSON.stringify(data)), error: () => undefined }); }
  private shuffle<T>(items: T[]): T[] { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
}
