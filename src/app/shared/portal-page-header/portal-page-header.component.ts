import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type PortalPageHeaderTone = 'admin' | 'delivery' | 'hotel';

@Component({
  selector: 'app-portal-page-header',
  standalone: true,
  templateUrl: './portal-page-header.component.html',
  styleUrl: './portal-page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalPageHeaderComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) subtitle = '';
  @Input() tone: PortalPageHeaderTone = 'admin';
}
