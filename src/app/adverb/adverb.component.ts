import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface AdverbExample { sentence: string; reading: string; meaning: string; }
export interface AdverbEntry {
  word: string; hiragana: string; hanViet?: string; meaning: string; level: string;
  examples: AdverbExample[]; note?: string;
}
interface LevelManifest { lessons: number[]; }

@Component({ selector: 'app-adverb', standalone: false, templateUrl: './adverb.component.html', styleUrl: './adverb.component.css' })
export class AdverbComponent implements OnInit {
  readonly levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
  selectedLevel = 'N5';
  lessons: number[] = [];
  selectedLesson: number | null = null;
  entries: AdverbEntry[] = [];
  mode: 'flashcard' | 'quiz' = 'flashcard';
  loading = false;
  error = '';
  index = 0;
  flipped = false;
  quizQuestions: { entry: AdverbEntry; options: string[] }[] = [];
  questionIndex = 0;
  selectedAnswer: string | null = null;
  answers: { word: string; selected: string; correct: string; ok: boolean }[] = [];
  quizFinished = false;

  constructor(private http: HttpClient) {}
  ngOnInit(): void { this.loadManifest(); }
  loadManifest(): void {
    this.http.get<LevelManifest>(`assets/adverb-data/${this.selectedLevel}/manifest.json`).subscribe({
      next: data => { this.lessons = data.lessons || []; this.selectedLesson = null; this.entries = []; },
      error: () => { this.lessons = []; this.selectedLesson = null; this.entries = []; }
    });
  }
  changeLevel(level: string): void { this.selectedLevel = level; this.error = ''; this.loadManifest(); }
  selectLesson(value: string): void {
    if (!value) { this.selectedLesson = null; this.entries = []; return; }
    const lesson = Number(value); this.selectedLesson = lesson; this.loading = true; this.error = '';
    this.http.get<AdverbEntry[]>(`assets/adverb-data/${this.selectedLevel}/lesson${lesson}.json`).subscribe({
      next: data => {
        if (data.length !== 10) { this.error = `Lesson này có ${data.length} từ; quy tắc hiện tại yêu cầu đúng 10 từ.`; }
        this.entries = data; this.index = 0; this.flipped = false; this.loading = false; this.resetQuiz();
      },
      error: () => { this.entries = []; this.loading = false; this.error = 'Không tải được dữ liệu bài học. Hãy kiểm tra file JSON.'; }
    });
  }
  get current(): AdverbEntry | null { return this.entries[this.index] || null; }
  next(): void { if (this.entries.length) { this.index = (this.index + 1) % this.entries.length; this.flipped = false; } }
  previous(): void { if (this.entries.length) { this.index = (this.index - 1 + this.entries.length) % this.entries.length; this.flipped = false; } }
  shuffle(): void { this.entries = [...this.entries].sort(() => Math.random() - .5); this.index = 0; this.flipped = false; }
  setMode(mode: 'flashcard' | 'quiz'): void { this.mode = mode; if (mode === 'quiz') this.startQuiz(); }
  startQuiz(): void {
    if (!this.entries.length) return;
    const pool = [...this.entries].sort(() => Math.random() - .5);
    this.quizQuestions = pool.slice(0, Math.min(10, pool.length)).map(entry => {
      const distractors = [...new Set(this.entries.filter(x => x.word !== entry.word).map(x => x.meaning))].sort(() => Math.random() - .5).slice(0, 3);
      return { entry, options: [...distractors, entry.meaning].sort(() => Math.random() - .5) };
    });
    this.questionIndex = 0; this.selectedAnswer = null; this.answers = []; this.quizFinished = false;
  }
  choose(answer: string): void {
    if (this.selectedAnswer !== null || !this.quizQuestions[this.questionIndex]) return;
    this.selectedAnswer = answer;
    const q = this.quizQuestions[this.questionIndex];
    this.answers.push({ word: q.entry.word, selected: answer, correct: q.entry.meaning, ok: answer === q.entry.meaning });
  }
  nextQuestion(): void {
    if (this.selectedAnswer === null) return;
    if (this.questionIndex + 1 >= this.quizQuestions.length) this.quizFinished = true;
    else { this.questionIndex++; this.selectedAnswer = null; }
  }
  resetQuiz(): void { this.quizQuestions = []; this.questionIndex = 0; this.selectedAnswer = null; this.answers = []; this.quizFinished = false; }
  get score(): number { return this.answers.filter(x => x.ok).length; }
}