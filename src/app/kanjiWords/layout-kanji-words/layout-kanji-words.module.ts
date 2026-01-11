import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutKanjiWordsComponent } from './layout-kanji-words.component';
import { KanjiWordsFlashcardModule } from '../flashcard/flashcard.module';
import { LayoutKanjiWordsRoutingModule } from './layout-kanji-words.routing.module';
import { KanjiWordsLessonSelectorComponent } from '../lesson-selector/lesson-selector.component';
import { KanjiWordsQuizModule } from '../quiz/kanji-quiz.module';

@NgModule({
  declarations: [
    LayoutKanjiWordsComponent,
    KanjiWordsLessonSelectorComponent,
  ],
  imports: [
    CommonModule,
    KanjiWordsFlashcardModule,
    LayoutKanjiWordsRoutingModule,
    KanjiWordsQuizModule,
  ],
  exports: [LayoutKanjiWordsComponent],
})
export class LayoutKanjiWordsModule {}
