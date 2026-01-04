import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-reduplicative-flashcard',
  standalone: false,
  templateUrl: './flashcard.component.html',
  styleUrl: './flashcard.component.css'
})
export class ReduplicativeFlashcardComponent {
  @Input() wordData: any[] = [];
  currentIndex = 0;
  isFlipped = false;

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
  }

  nextCard() {
    if (this.wordData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.wordData.length);
      this.isFlipped = false;
    }
  }

  prevCard() {
    if (this.wordData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.wordData.length);
      this.isFlipped = false;
    }
  }

  speak(event: Event) {
    event.stopPropagation();
    if (this.wordData[this.currentIndex]?.japanese) {
      const utterance = new SpeechSynthesisUtterance(
        this.wordData[this.currentIndex].japanese
      );
      utterance.lang = 'ja-JP';
      speechSynthesis.speak(utterance);
    }
  }
}

