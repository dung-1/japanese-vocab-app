import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FlashcardComponent } from './flashcard.component';
import { NgIf } from '@angular/common';

@NgModule({
  declarations: [FlashcardComponent],
  imports: [
    NgIf

  ],

  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [FlashcardComponent],
})
export class FlashcardComponentModule {}