import { Component, EventEmitter, Output } from '@angular/core';

export type KanjiLevel = 'N2' | 'N3';

@Component({
  selector: 'app-kanji-words-lesson-selector',
  standalone: false,
  templateUrl: './lesson-selector.component.html',
  styleUrl: './lesson-selector.component.css'
})
export class KanjiWordsLessonSelectorComponent {
  readonly LEVEL_LESSON_COUNTS: Record<KanjiLevel, number> = { N2: 2, N3: 30 };
  selectedLevel: KanjiLevel = 'N3';
  selectedLesson = '';

  get lessons(): number[] {
    const count = this.LEVEL_LESSON_COUNTS[this.selectedLevel];
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  @Output() lessonSelected = new EventEmitter<{ level: KanjiLevel; lessonNumber: number }>();

  selectLevel(event: Event) {
    const level = (event.target as HTMLSelectElement).value as KanjiLevel;
    this.selectedLevel = level;
    this.selectedLesson = '';
  }

  selectLesson(event: Event) {
    const lessonNumber = (event.target as HTMLSelectElement).value;
    if (!lessonNumber) return;
    this.lessonSelected.emit({ level: this.selectedLevel, lessonNumber: Number(lessonNumber) });
  }
}
