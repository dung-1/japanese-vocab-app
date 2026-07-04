import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutGrammarComponent } from './layout-grammar.component';

const routes: Routes = [
  { path: '', component: LayoutGrammarComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LayoutGrammarRoutingModule {}
