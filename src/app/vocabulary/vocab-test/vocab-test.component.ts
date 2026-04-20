import { Component, Input, OnInit } from '@angular/core';

interface VocabItem {
  kanji: string;
  hiragana: string;
  hanViet: string;
  meaning: string;
}

interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  type: 'kanji-to-meaning' | 'hiragana-to-meaning' | 'meaning-to-kanji' | 'meaning-to-hiragana' | 'hanviet-to-kanji' | 'kanji-to-hiragana';
  vocabData: VocabItem;
}

@Component({
  selector: 'app-vocab-test',
  standalone: false,
  templateUrl: './vocab-test.component.html',
  styleUrl: './vocab-test.component.css'
})
export class VocabTestComponent implements OnInit {
  @Input() vocabData: VocabItem[] = [];
  
  totalQuestions: string = '5';
  quizStarted = false;
  showResult = false;
  quizQuestions: QuizQuestion[] = [];
  currentQuestionIndex = 0;
  selectedOption: string | null = null;
  correctAnswers = 0;
  timeLeft = 30;
  private questionTimer: any;
  answerHistory: { question: string, userAnswer: string, correctAnswer: string, isCorrect: boolean }[] = [];

  ngOnInit() {
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
    const questionCount = Math.min(Number(this.totalQuestions), shuffledData.length);
    const randomIndices = this.getRandomIndices(shuffledData.length, questionCount);
    
    const questionTypes = [
      'kanji-to-meaning',
      'hiragana-to-meaning',
      'meaning-to-kanji',
      'meaning-to-hiragana',
      'hanviet-to-kanji',
      'kanji-to-hiragana'
    ];
    
    for (let i = 0; i < questionCount; i++) {
      const currentIndex = randomIndices[i];
      const currentVocab = shuffledData[currentIndex];
      const questionType = questionTypes[i % questionTypes.length];
      
      switch (questionType) {
        case 'kanji-to-meaning':
          if (currentVocab.kanji) {
            this.quizQuestions.push(this.createKanjiToMeaningQuestion(currentVocab, shuffledData));
          }
          break;
        case 'hiragana-to-meaning':
          if (currentVocab.hiragana) {
            this.quizQuestions.push(this.createHiraganaToMeaningQuestion(currentVocab, shuffledData));
          }
          break;
        case 'meaning-to-kanji':
          if (currentVocab.kanji) {
            this.quizQuestions.push(this.createMeaningToKanjiQuestion(currentVocab, shuffledData));
          }
          break;
        case 'meaning-to-hiragana':
          if (currentVocab.hiragana) {
            this.quizQuestions.push(this.createMeaningToHiraganaQuestion(currentVocab, shuffledData));
          }
          break;
        case 'hanviet-to-kanji':
          if (currentVocab.hanViet && currentVocab.kanji) {
            this.quizQuestions.push(this.createHanVietToKanjiQuestion(currentVocab, shuffledData));
          }
          break;
        case 'kanji-to-hiragana':
          if (currentVocab.kanji && currentVocab.hiragana) {
            this.quizQuestions.push(this.createKanjiToHiraganaQuestion(currentVocab, shuffledData));
          }
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

  createKanjiToMeaningQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.meaning;
    const question = `"${vocab.kanji}" có nghĩa là gì?`;
    
    const options = this.getRandomOptions(
      allVocab.map(v => v.meaning),
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
      vocabData: vocab
    };
  }

  createHiraganaToMeaningQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.meaning;
    const question = `"${vocab.hiragana}" có nghĩa là gì?`;
    
    const options = this.getRandomOptions(
      allVocab.map(v => v.meaning),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'hiragana-to-meaning',
      vocabData: vocab
    };
  }

  createMeaningToKanjiQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.kanji;
    const question = `"${vocab.meaning}" được viết bằng kanji như nào?`;
    
    const options = this.getRandomOptions(
      allVocab.filter(v => v.kanji).map(v => v.kanji),
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
      vocabData: vocab
    };
  }

  createMeaningToHiraganaQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.hiragana;
    const question = `"${vocab.meaning}" được viết bằng hiragana như nào?`;
    
    const options = this.getRandomOptions(
      allVocab.map(v => v.hiragana),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'meaning-to-hiragana',
      vocabData: vocab
    };
  }

  createHanVietToKanjiQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.kanji;
    const question = `"${vocab.hanViet}" có cách viết kanji nào dưới đây?`;
    
    const options = this.getRandomOptions(
      allVocab.filter(v => v.kanji).map(v => v.kanji),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'hanviet-to-kanji',
      vocabData: vocab
    };
  }

  createKanjiToHiraganaQuestion(vocab: VocabItem, allVocab: VocabItem[]): QuizQuestion {
    const correctAnswer = vocab.hiragana;
    const question = `"${vocab.kanji}" được phát âm như nào?`;
    
    const options = this.getRandomOptions(
      allVocab.map(v => v.hiragana),
      correctAnswer,
      3
    );
    options.push(correctAnswer);
    this.shuffleArray(options);
    
    return {
      question,
      correctAnswer,
      options,
      type: 'kanji-to-hiragana',
      vocabData: vocab
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