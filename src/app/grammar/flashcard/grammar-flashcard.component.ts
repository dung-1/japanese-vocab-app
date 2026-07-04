import {
  Component, Input, OnChanges, OnDestroy, HostListener, SimpleChanges,
} from '@angular/core';
import { GrammarItem } from '../models/grammar.model';

@Component({
  selector: 'app-grammar-flashcard',
  standalone: false,
  templateUrl: './grammar-flashcard.component.html',
  styleUrls: ['./grammar-flashcard.component.css'],
})
export class GrammarFlashcardComponent implements OnChanges, OnDestroy {
  @Input() items: GrammarItem[] = [];

  currentIndex = 0;
  isFlipped = false;
  showReading: boolean[] = [];

  get current(): GrammarItem | null {
    return this.items[this.currentIndex] ?? null;
  }

  get progress(): number {
    return this.items.length ? ((this.currentIndex + 1) / this.items.length) * 100 : 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.reset();
    }
  }

  ngOnDestroy(): void {}

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.code === 'Space') { e.preventDefault(); this.flip(); }
    if (e.code === 'ArrowRight') this.next();
    if (e.code === 'ArrowLeft') this.prev();
  }

  flip(): void { this.isFlipped = !this.isFlipped; }

  next(): void {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
    }
  }

  prev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
    }
  }

  toggleReading(i: number): void {
    this.showReading[i] = !this.showReading[i];
  }

  speak(text: string, e: Event): void {
    e.stopPropagation();
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ja-JP';
    speechSynthesis.speak(utt);
  }

  private reset(): void {
    this.currentIndex = 0;
    this.isFlipped = false;
    this.showReading = Array(this.items.length).fill(false);
  }
}
