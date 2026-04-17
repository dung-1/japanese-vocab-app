import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { LessonSelectorComponent } from './lesson-selector.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [LessonSelectorComponent],
  imports: [CommonModule, FormsModule, CommonModule],

  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [LessonSelectorComponent],
})
export class LessonSelectorModule {}
