import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutKanjiWordsComponent } from './layout-kanji-words.component';

const routes: Routes = [
  {
    path: 'kanji-words',
    component: LayoutKanjiWordsComponent,
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  providers: [],
  exports: [RouterModule],
})
export class LayoutKanjiWordsRoutingModule { }
