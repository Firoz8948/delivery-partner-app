import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LiveUpdateService } from './core/services/live-update.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {
  private liveUpdate = inject(LiveUpdateService);
}
