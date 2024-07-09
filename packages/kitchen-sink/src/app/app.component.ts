import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Ui1Component } from "../shared/ui/ui-1.component";
import { Ui2Component } from "../shared/ui/ui-2.component";
import { Ui3Component } from "../shared/ui/ui-3.component";

@Component({
  standalone: true,
  imports: [RouterModule, Ui1Component, Ui2Component, Ui3Component],
  selector: 'app-root',
  template: `
    <h1>App Root</h1>
    <app-ui-1 />
    <app-ui-2 />
    <app-ui-3 />
    <router-outlet />
  `,
})
export class AppComponent {
  title = 'kitchen-sink';
}
