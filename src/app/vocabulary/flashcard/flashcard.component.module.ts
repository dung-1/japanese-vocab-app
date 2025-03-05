import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FlashcardComponent } from './flashcard.component';
import { CommonModule } from '@angular/common';
@NgModule({
  declarations: [FlashcardComponent],
  imports: [
    CommonModule,
  ],

  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [FlashcardComponent],
})
export class FlashcardModule {}