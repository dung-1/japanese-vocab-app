import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AiAssistantComponent } from './components/ai-assistant/ai-assistant.component';
import { AiSettingsComponent } from './components/ai-settings/ai-settings.component';

const routes: Routes = [
  {
    path: '',
    component: AiAssistantComponent,
  },
  {
    path: 'settings',
    component: AiSettingsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiRoutingModule {}