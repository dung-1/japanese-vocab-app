import { Component, Input, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Example {
  word: string;
  reading: string;
  meaning: string;
}

interface KanjiWord {
  kanji: string;
  amHan: string;
  nghia: string;
  onyomi: string;
  kunyomi: string;
  examples: Example[];
  mnemonic?: {
    text: string;
    illustration?: string;
  };
}

@Component({
  selector: 'app-kanji-words-flashcard',
  standalone: false,
  templateUrl: './flashcard.component.html',
  styleUrl: './flashcard.component.css'
})
export class KanjiWordsFlashcardComponent implements OnInit, OnDestroy {
  @Input() vocabData: KanjiWord[] = [];
  currentIndex = 0;
  isFlipped = false;
  showExamples = false;
  isMobile = false;
  private resizeHandler = () => this.checkMobile();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkMobile();
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  checkMobile() {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobile = window.innerWidth <= 768;
    } else {
      this.isMobile = false;
    }
  }

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    if (!this.isFlipped) {
      this.showExamples = false;
    }
  }

  nextCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
      this.showExamples = false;
    }
  }

  prevCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
      this.showExamples = false;
    }
  }

  toggleExamples(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showExamples = !this.showExamples;
  }

  closeModal() {
    this.showExamples = false;
  }

  getCurrentKanji(): KanjiWord | null {
    return this.vocabData && this.vocabData.length > 0 ? this.vocabData[this.currentIndex] : null;
  }
}
