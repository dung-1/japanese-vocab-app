import { NgModule } from '@angular/core';
import { BrowserModule, provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';

import { LessonSelectorComponentModule } from './lesson-selector/lesson-selector.component.module';
import { FlashcardComponentModule } from './flashcard/flashcard.component.module';
import { VocabTestComponentModule } from './vocab-test/vocab-test.component.module';
@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    LessonSelectorComponentModule,
    FlashcardComponentModule,
    VocabTestComponentModule
],
  providers: [
    provideClientHydration(withEventReplay())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
