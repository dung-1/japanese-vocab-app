import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AiAssistantModule } from './components/ai-assistant/ai-assistant.component.module';
import { AiSettingsComponentModule } from './components/ai-settings/ai-settings.component.module';
import { AiRoutingModule } from './ai-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    AiAssistantModule,
    AiSettingsComponentModule,
    AiRoutingModule,
  ],
})
export class AiModule {}