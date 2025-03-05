import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutkanjiRadicalsComponent } from './layoutkanji-radicals.component';
import { FlashcardModule } from '../flashcard/flashcard.module';
import { LayoutkanjiRadicalsRoutingModule } from './layoutkanji-radicals.routing.module';
import { LessonSelectorModule } from '../lesson-selector/lesson-selector.component.module';

@NgModule({
  declarations: [
    LayoutkanjiRadicalsComponent,
  ],
  imports: [
    CommonModule,
    FlashcardModule,
    LayoutkanjiRadicalsRoutingModule,
    LessonSelectorModule
],
  exports: [LayoutkanjiRadicalsComponent],
})
export class LayoutkanjiRadicalsModule {}