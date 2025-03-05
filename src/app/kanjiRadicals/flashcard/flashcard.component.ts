import { Component, Input } from '@angular/core';
@Component({
  selector: 'app-flashcard',
  standalone: false,
  templateUrl: './flashcard.component.html',
  styleUrl: './flashcard.component.css'
})
export class FlashcardComponent {
  @Input() vocabData: any[] = [];
  currentIndex = 0;

  isFlipped = false;

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
  }
  
  nextCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
    }
  }

  prevCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length);
      this.isFlipped = false;
    }
  }

}