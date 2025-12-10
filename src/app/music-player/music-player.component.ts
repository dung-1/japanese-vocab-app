import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { MusicPlayerService } from '../services/music-player.service';

@Component({
  selector: 'app-music-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './music-player.component.html',
  styleUrls: ['./music-player.component.css'],
})
export class MusicPlayerComponent {
  protected isExpanded = signal(false);

  constructor(protected music: MusicPlayerService) {}

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
  }

  onMainClick(): void {
    if (!this.isExpanded()) {
      this.isExpanded.set(true);
    }
    this.music.playPause();
  }
}

