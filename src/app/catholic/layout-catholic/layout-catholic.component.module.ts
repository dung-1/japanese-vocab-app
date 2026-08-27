import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LayoutCatholicComponent } from './layout-catholic.component';
import { LayoutCatholicRoutingModule } from './layout-catholic.routing.module';
import { CatholicLessonSelectorComponent } from '../lesson-selector/catholic-lesson-selector.component';
import { CatholicFlashcardComponent } from '../flashcard/catholic-flashcard.component';
import { CatholicQuizComponent } from '../quiz/catholic-quiz.component';
@NgModule({ declarations: [LayoutCatholicComponent, CatholicLessonSelectorComponent, CatholicFlashcardComponent, CatholicQuizComponent], imports: [CommonModule, FormsModule, RouterModule, LayoutCatholicRoutingModule] })
export class LayoutCatholicComponentModule {}
