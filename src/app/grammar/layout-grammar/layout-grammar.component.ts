import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GrammarItem, GrammarQuizResult } from '../models/grammar.model';
import { GrammarService } from '../services/grammar.service';

type StudyMode = 'flashcard' | 'quiz';

@Component({
  selector: 'app-layout-grammar',
  standalone: false,
  templateUrl: './layout-grammar.component.html',
  styleUrls: ['./layout-grammar.component.css'],
})
export class LayoutGrammarComponent implements OnInit {
  studyMode: StudyMode = 'flashcard';
  selectedItems: GrammarItem[] = [];
  stats: Record<string, any> = {};
  loading = false;

  currentLevel = '';
  currentLesson = 0;

  overallStats = { totalLessons: 0, avgScore: 0, totalAttempts: 0 };

  constructor(
    private grammarService: GrammarService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.grammarService.preloadAll();
      this.stats = this.grammarService.loadStats();
      this.overallStats = this.grammarService.getOverallStats();
    }
  }

  setMode(mode: StudyMode): void {
    this.studyMode = mode;
  }

  async onLessonSelected(sel: { level: string; lesson: number }): Promise<void> {
    this.loading = true;
    this.currentLevel = sel.level;
    this.currentLesson = sel.lesson;
    this.selectedItems = await this.grammarService.loadLesson(sel.level, sel.lesson);
    this.loading = false;
  }

  onQuizDone(results: GrammarQuizResult[]): void {
    if (!this.currentLevel) return;
    this.grammarService.saveQuizResult(this.currentLevel, this.currentLesson, results);
    this.stats = this.grammarService.loadStats();
    this.overallStats = this.grammarService.getOverallStats();
  }
}
