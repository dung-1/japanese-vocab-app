import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { NgIf } from '@angular/common';
import { HomeComponent } from './home.component';

@NgModule({
  declarations: [HomeComponent],
  imports: [
    NgIf

  ],

  schemas: [
    CUSTOM_ELEMENTS_SCHEMA
  ],
  exports: [HomeComponent],
})
export class HomeModule {}