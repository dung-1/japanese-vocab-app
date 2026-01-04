import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-reduplicative-lesson-selector',
  standalone: false,
  templateUrl: './lesson-selector.component.html',
  styleUrl: './lesson-selector.component.css'
})
export class ReduplicativeLessonSelectorComponent {
  lessons = Array.from({ length: 10 }, (_, i) => i + 1);
  @Output() lessonSelected = new EventEmitter<number>();

  selectLesson(event: Event) {
    const lessonNumber = (event.target as HTMLSelectElement).value;
    this.lessonSelected.emit(Number(lessonNumber));
  }
}

