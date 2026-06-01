import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumberPracticeComponent } from './number-practice.component';
import { NumberPracticeRoutingModule } from './number-practice-routing.module';

@NgModule({
  declarations: [NumberPracticeComponent],
  imports: [
    CommonModule,
    FormsModule,
    NumberPracticeRoutingModule,
  ],
  exports: [NumberPracticeComponent],
})
export class NumberPracticeModule {}
