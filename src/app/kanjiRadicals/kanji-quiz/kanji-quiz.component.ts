import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

interface KanjiRadical {
  radical: string;
  meaning: string;
  strokeCount: number;
  exampleKanji: string[];
  memoryTrick: string;
  pronunciations: string[];
  explanation: string;
}

interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  type: 'radical-to-meaning' | 'meaning-to-radical';
}

@Component({
  selector: 'app-kanji-quiz',
  templateUrl: './kanji-quiz.component.html',
  styleUrls: ['./kanji-quiz.component.css'],
  standalone: false,
})
export class KanjiQuizComponent implements OnChanges {
  @Input() vocabData: KanjiRadical[] = [];
  
  quizQuestions: QuizQuestion[] = [];
  currentQuestionIndex: number = 0;
  showResult: boolean = false;
  selectedOption: string | null = null;
  correctAnswers: number = 0;
  totalQuestions: number = 10; // Mặc định số câu hỏi
  quizStarted: boolean = false;
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vocabData'] && this.vocabData && this.vocabData.length > 0) {
      this.resetQuiz();
    }
  }
  
  startQuiz(): void {
    this.quizStarted = true;
    this.generateQuizQuestions();
  }
  
  generateQuizQuestions(): void {
    this.quizQuestions = [];
    
    // Tạo một bản sao để không ảnh hưởng đến dữ liệu gốc
    const shuffledData = [...this.vocabData];
    
    // Đảm bảo số câu hỏi không vượt quá số lượng dữ liệu
    const questionCount = Math.min(this.totalQuestions, shuffledData.length);
    
    // Tạo một mảng các chỉ số ngẫu nhiên để chọn dữ liệu
    const randomIndices = this.getRandomIndices(shuffledData.length, questionCount);
    
    for (let i = 0; i < questionCount; i++) {
      const currentIndex = randomIndices[i];
      const currentKanji = shuffledData[currentIndex];
      
      // Xen kẽ giữa hỏi radical và meaning
      if (i % 2 === 0) {
        // Câu hỏi loại 2: Radical -> Meaning
        this.quizQuestions.push(this.createRadicalToMeaningQuestion(currentKanji, shuffledData));
      } else {
        // Câu hỏi loại 1: Meaning -> Radical
        this.quizQuestions.push(this.createMeaningToRadicalQuestion(currentKanji, shuffledData));
      }
    }
    
    // Khởi tạo lại các biến
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.showResult = false;
    this.selectedOption = null;
  }
  
  createMeaningToRadicalQuestion(kanji: KanjiRadical, allKanji: KanjiRadical[]): QuizQuestion {
    const correctAnswer = kanji.radical;
    const question = `Chữ "${kanji.meaning}" có cách viết nào dưới đây?`;
    
    // Lấy 3 radical ngẫu nhiên khác để làm đáp án sai
    const options = this.getRandomOptions(
      allKanji.map(k => k.radical),
      correctAnswer,
      3
    );
    
    // Thêm đáp án đúng vào mảng options
    options.push(correctAnswer);
    
    // Trộn ngẫu nhiên các đáp án
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'meaning-to-radical'
    };
  }
  
  createRadicalToMeaningQuestion(kanji: KanjiRadical, allKanji: KanjiRadical[]): QuizQuestion {
    const correctAnswer = kanji.meaning;
    const question = `Chữ "${kanji.radical}" có nghĩa là gì?`;
    
    // Lấy 3 meaning ngẫu nhiên khác để làm đáp án sai
    const options = this.getRandomOptions(
      allKanji.map(k => k.meaning),
      correctAnswer,
      3
    );
    
    // Thêm đáp án đúng vào mảng options
    options.push(correctAnswer);
    
    // Trộn ngẫu nhiên các đáp án
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'radical-to-meaning'
    };
  }
  
  getRandomOptions(allOptions: string[], correctAnswer: string, count: number): string[] {
    // Lọc ra các lựa chọn khác với đáp án đúng
    const filteredOptions = allOptions.filter(option => option !== correctAnswer);
    
    // Đảm bảo không có trùng lặp bằng cách sử dụng Set
    const uniqueOptions = [...new Set(filteredOptions)];
    
    // Trộn ngẫu nhiên
    this.shuffleArray(uniqueOptions);
    
    // Lấy count phần tử đầu tiên hoặc ít hơn nếu không đủ
    return uniqueOptions.slice(0, count);
  }
  
  getRandomIndices(max: number, count: number): number[] {
    const indices = Array.from({ length: max }, (_, i) => i);
    this.shuffleArray(indices);
    return indices.slice(0, count);
  }
  
  shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  selectOption(option: string): void {
    if (this.selectedOption !== null) return; // Ngăn chọn nhiều lần
    
    this.selectedOption = option;
    if (option === this.getCurrentQuestion().correctAnswer) {
      this.correctAnswers++;
    }
  }
  
  getCurrentQuestion(): QuizQuestion {
    return this.quizQuestions[this.currentQuestionIndex];
  }
  
  nextQuestion(): void {
    if (this.currentQuestionIndex < this.quizQuestions.length - 1) {
      this.currentQuestionIndex++;
      this.selectedOption = null;
    } else {
      this.showResult = true;
    }
  }
  
  resetQuiz(): void {
    this.quizStarted = false;
    this.quizQuestions = [];
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.showResult = false;
    this.selectedOption = null;
  }
  
  isCorrectOption(option: string): boolean {
    return this.selectedOption === option && option === this.getCurrentQuestion().correctAnswer;
  }
  
  isWrongOption(option: string): boolean {
    return this.selectedOption === option && option !== this.getCurrentQuestion().correctAnswer;
  }
}