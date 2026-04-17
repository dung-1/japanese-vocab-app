import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-lesson-selector',
  standalone: false,
  templateUrl: './lesson-selector.component.html',
  styleUrl: './lesson-selector.component.css'
})
export class LessonSelectorComponent {
  levels = ['N3', 'N4'];
  selectedLevel = 'N3';
  lessons: number[] = [];
  selectedLesson: number | null = null;

  @Output() lessonSelected = new EventEmitter<{level: string, lesson: number}>();

  constructor() {
    this.updateLessons();
  }

  onLevelChange(event: Event) {
    this.selectedLevel = (event.target as HTMLSelectElement).value;
    this.selectedLesson = null;
    this.updateLessons();
  }


  selectLesson(event: Event) {
    const lessonNumber = (event.target as HTMLSelectElement).value;
    if (!lessonNumber) return;
    this.lessonSelected.emit({ level: this.selectedLevel, lesson: Number(lessonNumber) });
  }
  private updateLessons() {
    if (this.selectedLevel === 'N3') {
      this.lessons = Array.from({ length: 22 }, (_, i) => i + 1);
    } else if (this.selectedLevel === 'N4') {
      this.lessons = Array.from({ length: 25 }, (_, i) => i + 26);
    }
  }
}
