import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { catchError, of, tap } from 'rxjs';

type ManifestEntry = string | { file: string; title?: string };
interface PlaylistManifest {
  tracks: ManifestEntry[];
}

export interface MusicTrack {
  src: string;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class MusicPlayerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly audio = this.isBrowser ? new Audio() : null;
  private tracks: MusicTrack[] = [];
  private currentIndex = signal(0);

  readonly isPlaying = signal(false);
  readonly currentTrack = computed(() => this.tracks[this.currentIndex()] ?? null);
  readonly hasTracks = computed(() => this.tracks.length > 0);

  constructor() {
    if (this.isBrowser && this.audio) {
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => this.next(true));
      this.audio.addEventListener('play', () => this.isPlaying.set(true));
      this.audio.addEventListener('pause', () => this.isPlaying.set(false));
      this.audio.addEventListener('error', (err) => {
        if (!isDevMode()) {
          return;
        }
        // eslint-disable-next-line no-console
        console.error('Audio error', err);
      });
      this.loadManifest();
    }
  }

  private loadManifest(): void {
    this.http
      .get<PlaylistManifest>('assets/list-music/playlist.json')
      .pipe(
        catchError((err) => {
          if (isDevMode()) {
            // eslint-disable-next-line no-console
            console.warn('No music playlist found at assets/list-music/playlist.json', err);
          }
          return of({ tracks: [] } satisfies PlaylistManifest);
        }),
        tap((manifest) => this.setPlaylist(manifest.tracks))
      )
      .subscribe();
  }

  private setPlaylist(entries: ManifestEntry[]): void {
    this.tracks = entries.map((entry) => {
      if (typeof entry === 'string') {
        return { src: this.normalizeSrc(entry), title: this.prettyTitleFromFile(entry) };
      }
      return {
        src: this.normalizeSrc(entry.file),
        title: entry.title ?? this.prettyTitleFromFile(entry.file),
      };
    });

    this.shuffleTracks();

    if (this.tracks.length > 0) {
      this.currentIndex.set(0);
      this.applyCurrentSource();
    }
  }

  playPause(): void {
    if (!this.isBrowser || !this.audio || !this.hasTracks()) return;
    if (this.isPlaying()) {
      this.audio.pause();
    } else {
      void this.audio.play();
    }
  }

  next(fromEnded = false): void {
    if (!this.isBrowser || !this.audio || !this.hasTracks()) return;
    const nextIndex = (this.currentIndex() + 1) % this.tracks.length;
    this.currentIndex.set(nextIndex);
    this.applyCurrentSource();
    if (fromEnded || this.isPlaying()) {
      void this.audio.play();
    }
  }

  prev(): void {
    if (!this.isBrowser || !this.audio || !this.hasTracks()) return;
    const prevIndex = (this.currentIndex() - 1 + this.tracks.length) % this.tracks.length;
    this.currentIndex.set(prevIndex);
    this.applyCurrentSource();
    if (this.isPlaying()) {
      void this.audio.play();
    }
  }

  private applyCurrentSource(): void {
    if (!this.audio) return;
    const track = this.currentTrack();
    if (!track) return;
    this.audio.src = track.src;
    this.audio.load();
  }

  private shuffleTracks(): void {
    for (let i = this.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  private normalizeSrc(file: string): string {
    // Allow either bare filename or relative path under assets/list-music.
    if (file.startsWith('http://') || file.startsWith('https://')) return file;
    if (file.startsWith('assets/')) return file;
    if (file.startsWith('/assets/')) return file.slice(1);
    return `assets/list-music/${file}`;
  }

  private prettyTitleFromFile(file: string): string {
    const name = file.split('/').pop() ?? file;
    const withoutExt = name.replace(/\.[^/.]+$/, '');
    return withoutExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown Track';
  }
}

