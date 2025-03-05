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
  private recognition: any;
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.recognition = new ((window as any)['SpeechRecognition'] || (window as any)['webkitSpeechRecognition'])();
      this.recognition.lang = 'ja-JP';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }
  ngOnChanges() {
  }


  flipCard() {
    this.isFlipped = !this.isFlipped;
  }

  nextCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length); 
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  prevCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length); 
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  speak(event: Event) {
    event.stopPropagation(); 
    const utterance = new SpeechSynthesisUtterance(
      this.vocabData[this.currentIndex].word
    );
    utterance.lang = 'ja-JP'; 
    speechSynthesis.speak(utterance);
  }
}
