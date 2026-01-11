import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

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

interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  type: 'kanji-to-meaning' | 'kanji-to-amhan' | 'kanji-to-onyomi' | 'kanji-to-kunyomi' | 'amhan-to-kanji' | 'meaning-to-kanji';
  kanjiData: KanjiWord;
}

@Component({
  selector: 'app-kanji-words-quiz',
  templateUrl: './kanji-quiz.component.html',
  styleUrls: ['./kanji-quiz.component.css'],
  standalone: false,
})
export class KanjiWordsQuizComponent implements OnChanges {
  @Input() vocabData: KanjiWord[] = [];
  
  quizQuestions: QuizQuestion[] = [];
  currentQuestionIndex: number = 0;
  showResult: boolean = false;
  selectedOption: string | null = null;
  correctAnswers: number = 0;
  totalQuestions: number = 10;
  quizStarted: boolean = false;
  timeLeft: number = 30;
  private questionTimer: any;
  answerHistory: { question: string, userAnswer: string, correctAnswer: string, isCorrect: boolean }[] = [];
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vocabData'] && this.vocabData && this.vocabData.length > 0) {
      this.resetQuiz();
    }
  }
  
  startQuiz(): void {
    if (this.vocabData.length === 0) {
      return;
    }
    this.quizStarted = true;
    this.generateQuizQuestions();
    this.startQuestionTimer();
  }
  
  generateQuizQuestions(): void {
    this.quizQuestions = [];
    const shuffledData = [...this.vocabData];
    const questionCount = Math.min(this.totalQuestions, shuffledData.length);
    const randomIndices = this.getRandomIndices(shuffledData.length, questionCount);
    
    const questionTypes = [
      'kanji-to-meaning',
      'kanji-to-amhan',
      'kanji-to-onyomi',
      'kanji-to-kunyomi',
      'amhan-to-kanji',
      'meaning-to-kanji'
    ];
    
    for (let i = 0; i < questionCount; i++) {
      const currentIndex = randomIndices[i];
      const currentKanji = shuffledData[currentIndex];
      const questionType = questionTypes[i % questionTypes.length];
      
      switch (questionType) {
        case 'kanji-to-meaning':
          this.quizQuestions.push(this.createKanjiToMeaningQuestion(currentKanji, shuffledData));
          break;
        case 'kanji-to-amhan':
          this.quizQuestions.push(this.createKanjiToAmhanQuestion(currentKanji, shuffledData));
          break;
        case 'kanji-to-onyomi':
          this.quizQuestions.push(this.createKanjiToOnyomiQuestion(currentKanji, shuffledData));
          break;
        case 'kanji-to-kunyomi':
          this.quizQuestions.push(this.createKanjiToKunyomiQuestion(currentKanji, shuffledData));
          break;
        case 'amhan-to-kanji':
          this.quizQuestions.push(this.createAmhanToKanjiQuestion(currentKanji, shuffledData));
          break;
        case 'meaning-to-kanji':
          this.quizQuestions.push(this.createMeaningToKanjiQuestion(currentKanji, shuffledData));
          break;
      }
    }
    
    // Shuffle questions
    this.shuffleArray(this.quizQuestions);
    
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.showResult = false;
    this.selectedOption = null;
    this.answerHistory = [];
  }
  
  createKanjiToMeaningQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.nghia;
    const question = `Chữ "${kanji.kanji}" có nghĩa là gì?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.nghia),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'kanji-to-meaning',
      kanjiData: kanji
    };
  }
  
  createKanjiToAmhanQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.amHan;
    const question = `Chữ "${kanji.kanji}" có âm Hán-Việt là gì?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.amHan),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'kanji-to-amhan',
      kanjiData: kanji
    };
  }
  
  createKanjiToOnyomiQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.onyomi;
    const question = `Chữ "${kanji.kanji}" có On'yomi là gì?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.onyomi),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'kanji-to-onyomi',
      kanjiData: kanji
    };
  }
  
  createKanjiToKunyomiQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.kunyomi;
    const question = `Chữ "${kanji.kanji}" có Kun'yomi là gì?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.kunyomi),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'kanji-to-kunyomi',
      kanjiData: kanji
    };
  }
  
  createAmhanToKanjiQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.kanji;
    const question = `"${kanji.amHan}" có cách viết nào dưới đây?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.kanji),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'amhan-to-kanji',
      kanjiData: kanji
    };
  }
  
  createMeaningToKanjiQuestion(kanji: KanjiWord, allKanji: KanjiWord[]): QuizQuestion {
    const correctAnswer = kanji.kanji;
    const question = `"${kanji.nghia}" có cách viết nào dưới đây?`;
    
    const options = this.getRandomOptions(
      allKanji.map(k => k.kanji),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'meaning-to-kanji',
      kanjiData: kanji
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
