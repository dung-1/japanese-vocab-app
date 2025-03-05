import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutkanjiRadicalsComponent } from './layoutkanji-radicals.component';

const routes: Routes = [
  {
    path: 'kanji-radicals',
    component: LayoutkanjiRadicalsComponent,
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  providers: [],
  exports: [RouterModule],
})
export class  LayoutkanjiRadicalsRoutingModule { }