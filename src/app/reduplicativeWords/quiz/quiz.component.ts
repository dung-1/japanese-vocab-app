import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

interface ReduplicativeWord {
  japanese: string;
  romaji: string;
  vietnamese: string;
  category: string;
}

interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  type: 'japanese-to-vietnamese' | 'vietnamese-to-japanese' | 'romaji-to-vietnamese';
  wordData: ReduplicativeWord;
}

@Component({
  selector: 'app-reduplicative-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css'],
  standalone: false,
})
export class ReduplicativeQuizComponent implements OnChanges {
  @Input() wordData: ReduplicativeWord[] = [];

  quizQuestions: QuizQuestion[] = [];
  currentQuestionIndex: number = 0;
  showResult: boolean = false;
  selectedOption: string | null = null;
  correctAnswers: number = 0;
  totalQuestions: number = 10;
  quizStarted: boolean = false;
  timeLeft: number = 30;
  private timer: any;
  private questionTimer: any;
  answerHistory: { question: string, userAnswer: string, correctAnswer: string, isCorrect: boolean }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['wordData'] && this.wordData && this.wordData.length > 0) {
      this.resetQuiz();
    }
  }

  startQuiz(): void {
    if (this.wordData.length === 0) {
      return;
    }
    this.quizStarted = true;
    this.generateQuizQuestions();
    this.startQuestionTimer();
  }

  generateQuizQuestions(): void {
    this.quizQuestions = [];
    const shuffledData = [...this.wordData];
    const questionCount = Math.min(this.totalQuestions, shuffledData.length);
    const randomIndices = this.getRandomIndices(shuffledData.length, questionCount);

    for (let i = 0; i < questionCount; i++) {
      const currentIndex = randomIndices[i];
      const currentWord = shuffledData[currentIndex];
      const questionType = i % 3;
      
      if (questionType === 0) {
        this.quizQuestions.push(this.createJapaneseToVietnameseQuestion(currentWord, shuffledData));
      } else if (questionType === 1) {
        this.quizQuestions.push(this.createVietnameseToJapaneseQuestion(currentWord, shuffledData));
      } else {
        this.quizQuestions.push(this.createRomajiToVietnameseQuestion(currentWord, shuffledData));
      }
    }

    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.showResult = false;
    this.selectedOption = null;
    this.answerHistory = [];
  }

  createJapaneseToVietnameseQuestion(word: ReduplicativeWord, allWords: ReduplicativeWord[]): QuizQuestion {
    const correctAnswer = word.vietnamese;
    const question = `Nghĩa của "${word.japanese}" là gì?`;
    
    const options = this.getRandomOptions(
      allWords.map(w => w.vietnamese),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);

    return {
      question,
      correctAnswer,
      options,
      type: 'japanese-to-vietnamese',
      wordData: word
    };
  }

  createVietnameseToJapaneseQuestion(word: ReduplicativeWord, allWords: ReduplicativeWord[]): QuizQuestion {
    const correctAnswer = word.japanese;
    const question = `"${word.vietnamese}" trong tiếng Nhật là gì?`;
    
    const options = this.getRandomOptions(
      allWords.map(w => w.japanese),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);

    return {
      question,
      correctAnswer,
      options,
      type: 'vietnamese-to-japanese',
      wordData: word
    };
  }

  createRomajiToVietnameseQuestion(word: ReduplicativeWord, allWords: ReduplicativeWord[]): QuizQuestion {
    const correctAnswer = word.vietnamese;
    const question = `Nghĩa của "${word.romaji}" là gì?`;
    
    const options = this.getRandomOptions(
      allWords.map(w => w.vietnamese),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);

    return {
      question,
      correctAnswer,
      options,
      type: 'romaji-to-vietnamese',
      wordData: word
    };
  }

  getRandomOptions(allOptions: string[], correctAnswer: string, count: number): string[] {
    const filteredOptions = allOptions.filter(option => option !== correctAnswer);
    const uniqueOptions = [...new Set(filteredOptions)];
    this.shuffleArray(uniqueOptions);
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

  startQuestionTimer(): void {
    this.timeLeft = 30;
    if (this.questionTimer) {
      clearInterval(this.questionTimer);
    }
    this.questionTimer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.handleTimeout();
      }
    }, 1000);
  }

  handleTimeout(): void {
    clearInterval(this.questionTimer);
    // Auto-mark as wrong and move to next question
    const currentQuestion = this.getCurrentQuestion();
    this.answerHistory.push({
      question: currentQuestion.question,
      userAnswer: 'Hết thời gian',
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: false
    });
    this.nextQuestion();
  }

  selectOption(option: string): void {
    if (this.selectedOption !== null) return;
    
    clearInterval(this.questionTimer);
    this.selectedOption = option;
    const currentQuestion = this.getCurrentQuestion();
    const isCorrect = option === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      this.correctAnswers++;
    }

    this.answerHistory.push({
      question: currentQuestion.question,
      userAnswer: option,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: isCorrect
    });
  }

  getCurrentQuestion(): QuizQuestion {
    return this.quizQuestions[this.currentQuestionIndex];
  }

  nextQuestion(): void {
    clearInterval(this.questionTimer);
    if (this.currentQuestionIndex < this.quizQuestions.length - 1) {
      this.currentQuestionIndex++;
      this.selectedOption = null;
      this.startQuestionTimer();
    } else {
      this.finishQuiz();
    }
  }

  finishQuiz(): void {
    clearInterval(this.questionTimer);
    this.showResult = true;
    this.quizStarted = false;
  }

  resetQuiz(): void {
    clearInterval(this.questionTimer);
    this.quizStarted = false;
    this.quizQuestions = [];
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.showResult = false;
    this.selectedOption = null;
    this.timeLeft = 30;
    this.answerHistory = [];
  }

  isCorrectOption(option: string): boolean {
    return this.selectedOption === option && option === this.getCurrentQuestion().correctAnswer;
  }

  isWrongOption(option: string): boolean {
    return this.selectedOption === option && option !== this.getCurrentQuestion().correctAnswer;
  }
}

