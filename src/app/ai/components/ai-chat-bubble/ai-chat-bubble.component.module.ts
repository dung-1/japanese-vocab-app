import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiChatBubbleComponent } from './ai-chat-bubble.component';

@NgModule({
  declarations: [AiChatBubbleComponent],
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [AiChatBubbleComponent],
})
export class AiChatBubbleModule {}