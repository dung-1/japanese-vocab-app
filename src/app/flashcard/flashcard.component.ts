import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { map } from 'rxjs/operators';
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
  private pexelsApiKey = 'Qrig6M9Z36jrHT8klajxIJBZEyXxYKLrJcriJePEUy9vkzhScMHhfgvK';
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
    if (this.vocabData && this.vocabData.length > 0) {
      this.loadImagesForVocab();
    }
  }

  loadImagesForVocab() {
    this.vocabData.forEach(vocab => {
      if (!vocab.imageUrl) {
        this.fetchImage(vocab.meaning).subscribe((imageUrl: string) => {
          vocab.imageUrl = imageUrl;
        });
      }
    });
  }

  fetchImage(meaning: string) {
    // Lấy toàn bộ meaning làm từ khóa để tìm kiếm chính xác hơn
    const query = encodeURIComponent(meaning);
    const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1`;
    return this.http.get<any>(url, {
      headers: { Authorization: this.pexelsApiKey }
    }).pipe(
      map(response => response.photos[0]?.src?.medium || 'https://via.placeholder.com/150') // Ảnh medium hoặc mặc định
    );
  }

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
    const utterance = new SpeechSynthesisUtterance(
      this.vocabData[this.currentIndex].word
    );
    utterance.lang = 'ja-JP'; // Phát âm tiếng Nhật
    speechSynthesis.speak(utterance);
  }
}
