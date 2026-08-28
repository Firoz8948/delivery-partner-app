import { Component, EventEmitter, Input, Output } from '@angular/core';


@Component({
  selector: 'app-partner-contact-dialog',
  standalone: true,
  templateUrl: './partner-contact-dialog.component.html',
  styleUrl: './partner-contact-dialog.component.scss',
})
export class PartnerContactDialogComponent {
  @Input({ required: true }) partnerLabel = 'Partner';
  @Output() closed = new EventEmitter<void>();
}
