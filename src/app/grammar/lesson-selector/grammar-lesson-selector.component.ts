import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GrammarLevelConfig, GrammarService } from '../services/grammar.service';

@Component({
  selector: 'app-grammar-lesson-selector',
  standalone: false,
  templateUrl: './grammar-lesson-selector.component.html',
  styleUrls: ['./grammar-lesson-selector.component.css'],
})
export class GrammarLessonSelectorComponent implements OnInit {
  @Input() stats: Record<string, any> = {};
  @Output() lessonSelected = new EventEmitter<{ level: string; lesson: number }>();

  levels: GrammarLevelConfig[] = [];
  selectedLevel = 'N3';
  lessons: number[] = [];
  selectedLesson: number | null = null;

  constructor(private grammarService: GrammarService) {}

  ngOnInit(): void {
    this.levels = this.grammarService.levels;
    this.updateLessons();
  }

  onLevelChange(event: Event): void {
    this.selectedLevel = (event.target as HTMLSelectElement).value;
    this.selectedLesson = null;
    this.updateLessons();
  }

  onLessonChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (!val) return;
    const lesson = Number(val);
    this.selectedLesson = lesson;
    this.lessonSelected.emit({ level: this.selectedLevel, lesson });
  }

  getLessonScore(lesson: number): number | null {
    const key = `${this.selectedLevel}-${lesson}`;
    return this.stats[key]?.lastScore ?? null;
  }

  private updateLessons(): void {
    const cfg = this.levels.find(l => l.level === this.selectedLevel);
    if (!cfg) { this.lessons = []; return; }
    this.lessons = Array.from({ length: cfg.lessons }, (_, i) => cfg.startLesson + i);
  }
}
