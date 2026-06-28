import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AiSettingsComponent } from './ai-settings.component';

@NgModule({
  declarations: [AiSettingsComponent],
  imports: [CommonModule, FormsModule, RouterModule],
  exports: [AiSettingsComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AiSettingsComponentModule {}
