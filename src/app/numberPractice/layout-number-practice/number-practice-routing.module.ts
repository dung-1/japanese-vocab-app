import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NumberPracticeComponent } from './number-practice.component';

const routes: Routes = [
  { path: '', component: NumberPracticeComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NumberPracticeRoutingModule {}
