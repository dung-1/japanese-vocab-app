import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { GrammarItem, GrammarQuizQuestion, GrammarQuizResult } from '../models/grammar.model';
import { GrammarService } from '../services/grammar.service';

@Component({
  selector: 'app-grammar-quiz',
  standalone: false,
  templateUrl: './grammar-quiz.component.html',
  styleUrls: ['./grammar-quiz.component.css'],
})
export class GrammarQuizComponent implements OnInit, OnDestroy {
  @Input() items: GrammarItem[] = [];
  @Output() quizDone = new EventEmitter<GrammarQuizResult[]>();

  totalCount = '5';
  started = false;
  finished = false;

  questions: GrammarQuizQuestion[] = [];
  currentIndex = 0;
  selectedOption: string | null = null;
  results: GrammarQuizResult[] = [];

  timeLeft = 30;
  private timer: ReturnType<typeof setInterval> | null = null;

  get current(): GrammarQuizQuestion | null {
    return this.questions[this.currentIndex] ?? null;
  }
  get score(): number {
    return this.results.filter(r => r.isCorrect).length;
  }
  get percent(): number {
    return this.questions.length ? Math.round((this.score / this.questions.length) * 100) : 0;
  }
  get progress(): number {
    return this.questions.length ? ((this.currentIndex + 1) / this.questions.length) * 100 : 0;
  }

  constructor(private grammarService: GrammarService) {}

  ngOnInit(): void {}
  ngOnDestroy(): void { this.clearTimer(); }

  start(): void {
    if (!this.items.length) return;
    const count = Math.min(Number(this.totalCount), this.items.length);
    this.questions = this.grammarService.generateQuiz(this.items, count);
    this.currentIndex = 0;
    this.results = [];
    this.selectedOption = null;
    this.started = true;
    this.finished = false;
    this.startTimer();
  }

  select(option: string): void {
    if (this.selectedOption) return;
    this.clearTimer();
    this.selectedOption = option;
    this.results.push({
      question: this.current!,
      userAnswer: option,
      isCorrect: option === this.current!.correctAnswer,
    });
  }

  next(): void {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.selectedOption = null;
      this.startTimer();
    } else {
      this.finish();
    }
  }

  finish(): void {
    this.clearTimer();
    this.finished = true;
    this.started = false;
    this.quizDone.emit(this.results);
  }

  restart(): void {
    this.started = false;
    this.finished = false;
    this.questions = [];
    this.results = [];
    this.selectedOption = null;
    this.clearTimer();
  }

  isCorrect(opt: string): boolean {
    return !!this.selectedOption && opt === this.current?.correctAnswer;
  }

  isWrong(opt: string): boolean {
    return !!this.selectedOption && opt === this.selectedOption && opt !== this.current?.correctAnswer;
  }

  typeLabel(type: GrammarQuizQuestion['type']): string {
    const map: Record<GrammarQuizQuestion['type'], string> = {
      'meaning-to-pattern': 'Nghĩa → Mẫu',
      'pattern-to-meaning': 'Mẫu → Nghĩa',
      'formula-check': 'Cấu trúc',
      'example-match': 'Ví dụ',
      'fill-blank': 'Điền vào chỗ trống',
    };
    return map[type] ?? type;
  }

  private startTimer(): void {
    this.timeLeft = 30;
    this.clearTimer();
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) { this.handleTimeout(); }
    }, 1000);
  }

  private handleTimeout(): void {
    this.clearTimer();
    if (!this.selectedOption) {
      this.results.push({
        question: this.current!,
        userAnswer: 'Hết giờ',
        isCorrect: false,
      });
      this.selectedOption = '___timeout___';
      setTimeout(() => this.next(), 1000);
    }
  }

  private clearTimer(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
