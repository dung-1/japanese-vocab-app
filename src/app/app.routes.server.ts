import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Grammar routes không prerender vì cần localStorage
  { path: 'grammar', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];