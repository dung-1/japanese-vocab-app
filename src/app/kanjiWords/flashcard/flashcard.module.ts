import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { KanjiWordsFlashcardComponent } from './flashcard.component';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [KanjiWordsFlashcardComponent],
  imports: [
    CommonModule,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [KanjiWordsFlashcardComponent],
})
export class KanjiWordsFlashcardModule {}
