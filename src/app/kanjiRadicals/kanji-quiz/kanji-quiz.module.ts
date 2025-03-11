import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
import { KanjiQuizComponent } from './kanji-quiz.component';
@NgModule({
  declarations: [KanjiQuizComponent],
  imports: [
    CommonModule,
    FormsModule,
  ],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [KanjiQuizComponent],
})
export class  KanjiQuizModule {}