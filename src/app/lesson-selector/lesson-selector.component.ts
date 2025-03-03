import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-lesson-selector',
  standalone: false,
  templateUrl: './lesson-selector.component.html',
  styleUrl: './lesson-selector.component.css'
})
export class LessonSelectorComponent {
  lessons = Array.from({ length: 50 }, (_, i) => i + 1); // Tạo danh sách từ 1-50
  @Output() lessonSelected = new EventEmitter<number>();

  selectLesson(event: Event) {
    const lessonNumber = (event.target as HTMLSelectElement).value;
    this.lessonSelected.emit(Number(lessonNumber));
  }
}
