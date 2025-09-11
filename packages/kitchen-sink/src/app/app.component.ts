import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  selector: 'app-root',
  template: `
    <h1>Ngx Build Demo</h1>

    <router-outlet />
  `,
})
export class AppComponent {
  title = 'kitchen-sink';
}
