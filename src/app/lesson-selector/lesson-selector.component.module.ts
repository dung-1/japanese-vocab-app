import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { LessonSelectorComponent } from './lesson-selector.component';
import { NgFor } from '@angular/common';

@NgModule({
  declarations: [LessonSelectorComponent],
  imports: [
    NgFor

  ],

  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [LessonSelectorComponent],
})
export class LessonSelectorComponentModule {}