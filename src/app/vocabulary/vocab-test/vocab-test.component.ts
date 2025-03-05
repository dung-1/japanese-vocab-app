import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-vocab-test',
  standalone: false,
  templateUrl: './vocab-test.component.html',
  styleUrl: './vocab-test.component.css'
})
export class VocabTestComponent implements OnInit {
  @Input() vocabData: any[] = [];
  questionCount: string = '5';   testStarted = false;
  testFinished = false;
  questions: any[] = [];
  currentQuestionIndex = 0;
  currentQuestion: any = null; 
  userAnswer = '';
  correctAnswers = 0;
  timeLeft = 0;
  highScore = 0; 
  private timer: any;
  answerHistory: { question: string, userAnswer: string, correctAnswer: string, isCorrect: boolean }[] = []; // Thêm biến này

  ngOnInit() {
  }

  startTest() {
    this.testStarted = true;
    this.testFinished = false;
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.questions = this.generateQuestions();
    this.currentQuestion = this.questions[this.currentQuestionIndex]; 
    this.answerHistory = [];
    this.startTimer();
  }

  generateQuestions() {
    const shuffledData = this.shuffleArray([...this.vocabData]);
    const count = this.questionCount === 'all' ? this.vocabData.length : Number(this.questionCount);
    if (count == 5 ) {
      this.timeLeft=60;
    }else if (count == 10) {
      this.timeLeft=120;
    }else if (count == 20) {
      this.timeLeft=180;
    }else if (count == 30) {
      this.timeLeft=240;
    }
    else {
      this.timeLeft=300;
    }
    const selectedData = shuffledData.slice(0, count);

    return selectedData.map(item => {
      const type = Math.floor(Math.random() * 2); 
      return type === 0
        ? { question: `Nghĩa của "${item.word}" là gì?`, answer: item.meaning }
        : { question: `"${item.meaning}" trong tiếng Nhật là gì?`, answer: item.word };
    });
  }

  submitAnswer() {
    const correctAnswer = this.currentQuestion.answer.toLowerCase();
    const userAnswerTrimmed = this.userAnswer.trim().toLowerCase();
  
    let isCorrect = false;
  
  if (this.currentQuestion.question.includes('Nghĩa của')) {
    const normalizedCorrectAnswer = correctAnswer.replace(/…/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const correctWords = normalizedCorrectAnswer.split(' ');
    const userWords = userAnswerTrimmed.replace(/\s+/g, ' ').trim().split(' ');

    isCorrect = userWords.some(userWord => correctWords.includes(userWord));
  } else if (this.currentQuestion.question.includes('trong tiếng Nhật là gì')) {
    isCorrect = userAnswerTrimmed === correctAnswer;
  }

  if (isCorrect) {
    this.correctAnswers++;
  }
      this.answerHistory.push({
      question: this.currentQuestion.question,
      userAnswer: userAnswerTrimmed,
      correctAnswer: correctAnswer,
      isCorrect: isCorrect
    });
  
    this.userAnswer = '';
    this.currentQuestionIndex++;
  
    if (this.currentQuestionIndex >= this.questions.length) {
      this.finishTest();
    } else {
      this.currentQuestion = this.questions[this.currentQuestionIndex];
    }
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.finishTest();
      }
    }, 1000);
  }

  finishTest() {
    clearInterval(this.timer);
    this.testFinished = true;
    const score = (this.correctAnswers / this.questions.length) * 100;
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('highScore', this.highScore.toFixed(2));
    }
  }

  resetTest() {
    this.testStarted = false;
    this.testFinished = false;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;
    this.correctAnswers = 0;
    this.userAnswer = '';
    this.timeLeft = 0;
    this.answerHistory = [];
  }

  private shuffleArray(array: any[]): any[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}