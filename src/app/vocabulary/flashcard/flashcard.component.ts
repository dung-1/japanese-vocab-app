import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, Input, OnInit, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-flashcard',
  standalone: false,
  templateUrl: './flashcard.component.html',
  styleUrls: ['./flashcard.component.css'],
})
export class FlashcardComponent implements OnInit {
  @Input() vocabData: any[] = [];
  currentIndex = 0;
  isFlipped = false;
  pronunciationScore: number | null = null;
  private recognition: any = null;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const browserWindow = window as any;
    const SpeechRecognitionCtor =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    // Speech recognition is not supported in every browser (notably some mobile browsers).
    // The flashcard must remain usable even when this optional API is unavailable.
    if (!SpeechRecognitionCtor) {
      this.recognition = null;
      return;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = 'ja-JP';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
  }

  ngOnChanges(): void {}

  flipCard(): void {
    this.isFlipped = !this.isFlipped;
  }

  nextCard(): void {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  prevCard(): void {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  speak(event: Event): void {
    event.stopPropagation();

    if (!isPlatformBrowser(this.platformId) || !('speechSynthesis' in window)) {
      return;
    }

    const word = this.vocabData[this.currentIndex]?.word ??
      this.vocabData[this.currentIndex]?.kanji ??
      this.vocabData[this.currentIndex]?.hiragana;

    if (!word || typeof SpeechSynthesisUtterance === 'undefined') {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'ja-JP';
    window.speechSynthesis.speak(utterance);
  }
}
