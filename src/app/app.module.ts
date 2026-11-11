import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule, provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule, provideHttpClient, withFetch } from '@angular/common/http';
import { ServiceWorkerModule } from '@angular/service-worker';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MusicPlayerComponent } from './music-player/music-player.component';
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule, AppRoutingModule, RouterModule, CommonModule, FormsModule,
    HttpClientModule, MusicPlayerComponent,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [provideClientHydration(withEventReplay()), provideHttpClient(withFetch())],
  bootstrap: [AppComponent]
})
export class AppModule { }