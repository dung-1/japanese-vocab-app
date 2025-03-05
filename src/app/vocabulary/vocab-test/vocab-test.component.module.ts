import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { VocabTestComponent } from './vocab-test.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
@NgModule({
  declarations: [VocabTestComponent],
  imports: [
    CommonModule,
    FormsModule,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [VocabTestComponent],
})
export class  VocabTestModule {}