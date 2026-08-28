import { Component, Input, OnChanges } from '@angular/core';
import { CatholicQuestion } from '../models/catholic.model';
interface QuizQuestion { item: CatholicQuestion; options: string[]; }
@Component({ selector: 'app-catholic-quiz', standalone: false, templateUrl: './catholic-quiz.component.html', styleUrl: './catholic-quiz.component.css' })
export class CatholicQuizComponent implements OnChanges {
  @Input() questions: CatholicQuestion[] = [];
  total = '10'; started = false; finished = false; quiz: QuizQuestion[] = []; currentIndex = 0; selected: string | null = null; correct = 0;
  history: { question: string; answer: string; correctAnswer: string; isCorrect: boolean }[] = [];
  ngOnChanges() { this.reset(); }
  get current() { return this.quiz[this.currentIndex]; }
  start() { if (!this.questions.length) return; const count = Math.min(Number(this.total), this.questions.length); this.quiz = this.shuffle([...this.questions]).slice(0, count).map(item => ({ item, options: this.shuffle([item.answer, ...item.distractors]) })); this.started = true; this.finished = false; this.currentIndex = 0; this.correct = 0; this.selected = null; this.history = []; }
  choose(option: string) { if (this.selected) return; this.selected = option; const isCorrect = option === this.current.item.answer; if (isCorrect) this.correct++; this.history.push({ question: this.current.item.question, answer: option, correctAnswer: this.current.item.answer, isCorrect }); }
  next() { if (!this.selected) return; if (this.currentIndex === this.quiz.length - 1) { this.started = false; this.finished = true; } else { this.currentIndex++; this.selected = null; } }
  reset() { this.started = false; this.finished = false; this.quiz = []; this.currentIndex = 0; this.selected = null; this.correct = 0; this.history = []; }
  optionClass(option: string) { return this.selected ? (option === this.current.item.answer ? 'correct' : option === this.selected ? 'wrong' : '') : ''; }
  private shuffle<T>(items: T[]): T[] { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
}
