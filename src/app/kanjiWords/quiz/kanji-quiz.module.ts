import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { KanjiWordsQuizComponent } from './kanji-quiz.component';

@NgModule({
  declarations: [KanjiWordsQuizComponent],
  imports: [
    CommonModule,
    FormsModule,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [KanjiWordsQuizComponent],
})
export class KanjiWordsQuizModule {}
