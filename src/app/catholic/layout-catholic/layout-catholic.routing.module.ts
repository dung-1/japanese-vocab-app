import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutCatholicComponent } from './layout-catholic.component';
const routes: Routes = [{ path: 'catholic', component: LayoutCatholicComponent }];
@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class LayoutCatholicRoutingModule {}
