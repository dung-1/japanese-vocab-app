import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutVocabularyComponent } from './layout-vocabulary.component';

const routes: Routes = [
  {
    path: 'vocabulary',
    component: LayoutVocabularyComponent,
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  providers: [],
  exports: [RouterModule],
})
export class LayOutVocabularyRoutingModule { }