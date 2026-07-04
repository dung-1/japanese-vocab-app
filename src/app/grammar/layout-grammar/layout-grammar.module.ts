import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LayoutGrammarComponent } from './layout-grammar.component';
import { LayoutGrammarRoutingModule } from './layout-grammar.routing.module';
import { GrammarLessonSelectorComponent } from '../lesson-selector/grammar-lesson-selector.component';
import { GrammarFlashcardComponent } from '../flashcard/grammar-flashcard.component';
import { GrammarQuizComponent } from '../quiz/grammar-quiz.component';

@NgModule({
  declarations: [
    LayoutGrammarComponent,
    GrammarLessonSelectorComponent,
    GrammarFlashcardComponent,
    GrammarQuizComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    LayoutGrammarRoutingModule,
  ],
  exports: [LayoutGrammarComponent],
})
export class LayoutGrammarModule {}
