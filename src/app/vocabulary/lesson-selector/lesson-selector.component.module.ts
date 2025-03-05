import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { LessonSelectorComponent } from './lesson-selector.component';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [LessonSelectorComponent],
  imports: [CommonModule],

  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [LessonSelectorComponent],
})
export class LessonSelectorModule {}
