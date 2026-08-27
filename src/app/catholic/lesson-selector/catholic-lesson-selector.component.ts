import { Component, EventEmitter, Output } from '@angular/core';
@Component({ selector: 'app-catholic-lesson-selector', standalone: false, templateUrl: './catholic-lesson-selector.component.html', styleUrl: './catholic-lesson-selector.component.css' })
export class CatholicLessonSelectorComponent {
  @Output() lessonSelected = new EventEmitter<number>();
  lessons = Array.from({ length: 19 }, (_, index) => index + 1);
  select(value: string) { const lesson = Number(value); if (lesson) this.lessonSelected.emit(lesson); }
  label(lesson: number) { return lesson <= 9 ? `Bài ${lesson} · Cựu Ước` : lesson <= 15 ? `Bài ${lesson} · Tân Ước` : `Bài ${lesson} · Tổng hợp`; }
}
