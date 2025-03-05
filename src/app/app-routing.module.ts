import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LayoutVocabularyComponent } from './vocabulary/layout-vocabulary/layout-vocabulary.component';
import { LayoutVocabularyComponentModule } from './vocabulary/layout-vocabulary/layout-vocabulary.component.module';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { LayoutkanjiRadicalsModule } from './kanjiRadicals/layoutkanji-radicals/layoutkanji-radicals.module';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' }, // Trang mặc định
  { path: 'home', component: HomeComponent },{
    path: 'vocabulary',
    loadChildren: () =>
      import(
        './vocabulary/layout-vocabulary/layout-vocabulary.component.module'
      ).then((m) => m.LayoutVocabularyComponentModule),
  },
  { path: 'kanji-radicals', loadChildren: () => import('./kanjiRadicals/layoutkanji-radicals/layoutkanji-radicals.module').then(m => m.LayoutkanjiRadicalsModule) },
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [
    CommonModule,
    BrowserModule,
    RouterModule.forRoot(routes),
    LayoutVocabularyComponentModule,
    LayoutkanjiRadicalsModule
    
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
