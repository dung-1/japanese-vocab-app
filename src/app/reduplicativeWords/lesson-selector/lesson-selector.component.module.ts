import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReduplicativeLessonSelectorComponent } from './lesson-selector.component';

@NgModule({
  declarations: [ReduplicativeLessonSelectorComponent],
  imports: [CommonModule, FormsModule],
  exports: [ReduplicativeLessonSelectorComponent]
})
export class ReduplicativeLessonSelectorModule { }

