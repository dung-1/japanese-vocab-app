import { Component, Input, OnChanges } from '@angular/core';
import { CatholicQuestion } from '../models/catholic.model';
@Component({ selector: 'app-catholic-flashcard', standalone: false, templateUrl: './catholic-flashcard.component.html', styleUrl: './catholic-flashcard.component.css' })
export class CatholicFlashcardComponent implements OnChanges {
  @Input() questions: CatholicQuestion[] = []; currentIndex = 0; flipped = false;
  ngOnChanges() { this.currentIndex = 0; this.flipped = false; }
  get current() { return this.questions[this.currentIndex]; }
  next() { if (this.questions.length) { this.currentIndex = (this.currentIndex + 1) % this.questions.length; this.flipped = false; } }
  previous() { if (this.questions.length) { this.currentIndex = (this.currentIndex - 1 + this.questions.length) % this.questions.length; this.flipped = false; } }
}
