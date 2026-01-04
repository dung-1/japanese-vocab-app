import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutReduplicativeWordsComponent } from './layout-reduplicative-words.component';

const routes: Routes = [
  {
    path: 'reduplicative-words',
    component: LayoutReduplicativeWordsComponent,
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  providers: [],
  exports: [RouterModule],
})
export class LayoutReduplicativeWordsRoutingModule { }

