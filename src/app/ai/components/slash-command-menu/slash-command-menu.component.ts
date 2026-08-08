import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SlashCommand } from '../../models/slash-command.model';

@Component({
  selector: 'app-slash-command-menu',
  standalone: false,
  templateUrl: './slash-command-menu.component.html',
  styleUrl: './slash-command-menu.component.css',
})
export class SlashCommandMenuComponent {
  @Input() commands: SlashCommand[] = [];
  @Input() activeIndex = 0;

  @Output() selected = new EventEmitter<SlashCommand>();
  @Output() dismissed = new EventEmitter<void>();

  selectCommand(cmd: SlashCommand): void {
    this.selected.emit(cmd);
  }

  dismiss(): void {
    this.dismissed.emit();
  }
}
