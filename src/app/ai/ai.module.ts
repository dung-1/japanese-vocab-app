import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant.component';
import { AiChatBubbleComponent } from './components/ai-chat-bubble/ai-chat-bubble.component';
import { AiSettingsComponent } from './components/ai-settings/ai-settings.component';
import { SlashCommandMenuComponent } from './components/slash-command-menu/slash-command-menu.component';
import { ChatHistorySidebarComponent } from './components/chat-history-sidebar/chat-history-sidebar.component';
import { AiRoutingModule } from './ai-routing.module';

@NgModule({
  declarations: [
    AiAssistantComponent,
    AiChatBubbleComponent,
    AiSettingsComponent,
    SlashCommandMenuComponent,
    ChatHistorySidebarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    AiRoutingModule
  ],
  exports: [AiAssistantComponent]
})
export class AiModule {
}
