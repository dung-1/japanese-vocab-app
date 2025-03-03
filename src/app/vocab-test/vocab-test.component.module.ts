import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { VocabTestComponent } from './vocab-test.component';
import { FormsModule } from '@angular/forms';
@NgModule({
  declarations: [VocabTestComponent],
  imports: [
    NgFor,
    NgIf,
    NgClass,
    FormsModule
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [VocabTestComponent],
})
export class  VocabTestComponentModule {}