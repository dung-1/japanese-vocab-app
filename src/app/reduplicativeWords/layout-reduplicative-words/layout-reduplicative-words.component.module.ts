import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutReduplicativeWordsComponent } from './layout-reduplicative-words.component';
import { ReduplicativeFlashcardModule } from '../flashcard/flashcard.component.module';
import { LayoutReduplicativeWordsRoutingModule } from './layout-reduplicative-words.routing.module';
import { ReduplicativeLessonSelectorModule } from '../lesson-selector/lesson-selector.component.module';
import { ReduplicativeQuizModule } from '../quiz/quiz.component.module';

@NgModule({
  declarations: [
    LayoutReduplicativeWordsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReduplicativeFlashcardModule,
    LayoutReduplicativeWordsRoutingModule,
    ReduplicativeLessonSelectorModule,
    ReduplicativeQuizModule
  ],
  exports: [LayoutReduplicativeWordsComponent],
})
export class LayoutReduplicativeWordsModule {}

