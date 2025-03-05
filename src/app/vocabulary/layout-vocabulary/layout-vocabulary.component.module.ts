import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlashcardModule } from '../flashcard/flashcard.component.module';
import { LessonSelectorModule } from '../lesson-selector/lesson-selector.component.module';
import { VocabTestModule } from '../vocab-test/vocab-test.component.module';
import { LayoutVocabularyComponent } from './layout-vocabulary.component';
import { LayOutVocabularyRoutingModule } from './layout-vocabulary.routing.module';
@NgModule({
  declarations: [LayoutVocabularyComponent],
  imports: [    
    CommonModule,
    FlashcardModule,
    VocabTestModule,
    LessonSelectorModule,
    LayOutVocabularyRoutingModule

  ],
  exports: [LayoutVocabularyComponent],
})
export class LayoutVocabularyComponentModule {}