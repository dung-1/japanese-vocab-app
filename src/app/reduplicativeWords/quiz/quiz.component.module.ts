import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReduplicativeQuizComponent } from './quiz.component';

@NgModule({
  declarations: [ReduplicativeQuizComponent],
  imports: [CommonModule, FormsModule],
  exports: [ReduplicativeQuizComponent]
})
export class ReduplicativeQuizModule { }

