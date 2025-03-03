import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-flashcard',
  standalone: false,
  templateUrl: './flashcard.component.html',
  styleUrls: ['./flashcard.component.css']
})
export class FlashcardComponent {
  @Input() vocabData: any[] = [];
  currentIndex = 0;
  isFlipped = false;
  pronunciationScore: number | null = null;
  flipCard() {
    this.isFlipped = !this.isFlipped;
  }

  nextCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length); // Chọn ngẫu nhiên
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  prevCard() {
    if (this.vocabData.length > 0) {
      this.currentIndex = Math.floor(Math.random() * this.vocabData.length); // Chọn ngẫu nhiên
      this.isFlipped = false;
      this.pronunciationScore = null;
    }
  }

  speak(event: Event) {
    event.stopPropagation(); // Ngăn click vào nút làm lật flashcard
    const utterance = new SpeechSynthesisUtterance(this.vocabData[this.currentIndex].word);
    utterance.lang = 'ja-JP'; // Phát âm tiếng Nhật
    speechSynthesis.speak(utterance);
  }
}