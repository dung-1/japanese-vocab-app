import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LayoutkanjiRadicalsComponent } from './layoutkanji-radicals.component';
import { FlashcardModule } from '../flashcard/flashcard.module';
import { LayoutkanjiRadicalsRoutingModule } from './layoutkanji-radicals.routing.module';

@NgModule({
  declarations: [LayoutkanjiRadicalsComponent],
  imports: [    
    CommonModule,
    FlashcardModule,
    LayoutkanjiRadicalsRoutingModule


  ],
  exports: [LayoutkanjiRadicalsComponent],
})
export class LayoutkanjiRadicalsModule {}