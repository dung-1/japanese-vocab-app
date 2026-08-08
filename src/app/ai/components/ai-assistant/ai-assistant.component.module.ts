import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AiAssistantComponent } from './ai-assistant.component';
import { AiChatBubbleModule } from '../ai-chat-bubble/ai-chat-bubble.component.module';
import { SlashCommandMenuComponent } from '../slash-command-menu/slash-command-menu.component';

@NgModule({
  declarations: [AiAssistantComponent, SlashCommandMenuComponent],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AiChatBubbleModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [AiAssistantComponent],
})
export class AiAssistantModule {}
