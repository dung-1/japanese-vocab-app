import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { NumberJapaneseService, NumberQuestion } from '../number-japanese.service';

type Mode = 'menu' | 'read' | 'listen' | 'result';

interface SessionStat {
  number: number;
  reading: string;
  userAnswer: string;
  correct: boolean;
  mode: string;
}

@Component({
  selector: 'app-number-practice',
  standalone: false,
  templateUrl: './number-practice.component.html',
  styleUrls: ['./number-practice.component.css'],
})
export class NumberPracticeComponent implements OnInit, OnDestroy {

  // --- Cấu hình ---
  mode: Mode = 'menu';
  practiceMode: 'read' | 'listen' = 'read';
  selectedDigits = 3;
  digitOptions = [2, 3, 4, 5, 6, 7, 8, 9];
  questionsPerSession = 10;

  // --- Câu hỏi hiện tại ---
  currentQuestion: NumberQuestion | null = null;
  userAnswer = '';
  answerState: 'idle' | 'correct' | 'wrong' = 'idle';
  showReading = false;
  showAnswer = false;

  // --- Thống kê session ---
  sessionStats: SessionStat[] = [];
  correct = 0;
  wrong = 0;
  streak = 0;
  bestStreak = 0;
  questionIndex = 0;

  // --- Combo / animation ---
  showCombo = false;
  comboMessage = '';

  isBrowser = false;

  constructor(
    private svc: NumberJapaneseService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnDestroy() {
    if (this.isBrowser) window.speechSynthesis?.cancel();
  }

  // ---- Điều hướng ----

  startSession(practiceMode: 'read' | 'listen') {
    this.practiceMode = practiceMode;
    this.mode = practiceMode;
    this.resetSession();
    this.nextQuestion();
  }

  resetSession() {
    this.correct = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.questionIndex = 0;
    this.sessionStats = [];
    this.userAnswer = '';
    this.answerState = 'idle';
    this.showReading = false;
    this.showAnswer = false;
  }

  nextQuestion() {
    if (this.questionIndex >= this.questionsPerSession) {
      this.mode = 'result';
      return;
    }
    this.currentQuestion = this.svc.generateQuestion(this.selectedDigits);
    this.userAnswer = '';
    this.answerState = 'idle';
    this.showReading = false;
    this.showAnswer = false;
    this.questionIndex++;

    // Auto-speak cho chế độ listen
    if (this.practiceMode === 'listen') {
      setTimeout(() => this.speakCurrent(), 400);
    }
  }

  // ---- Chế độ READ: người dùng nghe và đọc số ----

  speakCurrent(rate = 0.85) {
    if (!this.currentQuestion) return;
    this.svc.speak(this.currentQuestion.reading, rate);
  }

  toggleReading() {
    this.showReading = !this.showReading;
  }

  // ---- Chế độ LISTEN: người dùng nghe rồi nhập số ----

  submitAnswer() {
    if (!this.currentQuestion || this.answerState !== 'idle') return;
    const input = String(this.userAnswer ?? '').trim().replace(/[,\s]/g, '');
    const correct = Number(input) === this.currentQuestion.number;

    this.answerState = correct ? 'correct' : 'wrong';
    this.sessionStats.push({
      number: this.currentQuestion.number,
      reading: this.currentQuestion.reading,
      userAnswer: this.userAnswer.trim(),
      correct,
      mode: this.practiceMode,
    });

    if (correct) {
      this.correct++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.triggerCombo();
    } else {
      this.wrong++;
      this.streak = 0;
      this.showAnswer = true;
    }
  }

  // Nhấn Enter để submit
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      if (this.answerState === 'idle') this.submitAnswer();
      else this.nextQuestion();
    }
  }

  // ---- Chế độ READ: đánh dấu đúng/sai thủ công ----
  markRead(isCorrect: boolean) {
    if (!this.currentQuestion || this.answerState !== 'idle') return;
    this.answerState = isCorrect ? 'correct' : 'wrong';
    this.sessionStats.push({
      number: this.currentQuestion.number,
      reading: this.currentQuestion.reading,
      userAnswer: isCorrect ? '✓' : '✗',
      correct: isCorrect,
      mode: this.practiceMode,
    });

    if (isCorrect) {
      this.correct++;
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
      this.triggerCombo();
    } else {
      this.wrong++;
      this.streak = 0;
      this.showReading = true;
    }
  }

  triggerCombo() {
    if (this.streak >= 10) this.comboMessage = '🔥🔥🔥 STREAK x' + this.streak + '!';
    else if (this.streak >= 5) this.comboMessage = '🔥 Combo x' + this.streak + '!';
    else if (this.streak >= 3) this.comboMessage = '✨ x' + this.streak + ' liên tiếp!';
    else { this.showCombo = false; return; }

    this.showCombo = true;
    setTimeout(() => (this.showCombo = false), 1500);
  }

  // ---- Kết quả ----

  get accuracy(): number {
    const total = this.correct + this.wrong;
    return total === 0 ? 0 : Math.round((this.correct / total) * 100);
  }

  get resultGrade(): string {
    if (this.accuracy >= 90) return '🏆 Xuất sắc!';
    if (this.accuracy >= 70) return '👍 Tốt!';
    if (this.accuracy >= 50) return '💪 Cần luyện thêm!';
    return '📚 Hãy ôn luyện thêm nhé!';
  }

  backToMenu() {
    if (this.isBrowser) window.speechSynthesis?.cancel();
    this.mode = 'menu';
  }

  replaySession() {
    this.startSession(this.practiceMode);
  }
}
