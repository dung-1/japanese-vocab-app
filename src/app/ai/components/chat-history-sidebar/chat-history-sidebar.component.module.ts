import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ChatHistorySidebarComponent } from './chat-history-sidebar.component';

@NgModule({
  declarations: [ChatHistorySidebarComponent],
  imports: [CommonModule, FormsModule, RouterModule],
  exports: [ChatHistorySidebarComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ChatHistorySidebarComponentModule {}
