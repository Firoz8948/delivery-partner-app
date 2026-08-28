import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterModule } from '@angular/router';


type LegalDocument = 'terms' | 'privacy' | 'refund';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private title = inject(Title);
  private meta = inject(Meta);

  document = signal<LegalDocument>('terms');

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const value = params.get('document');
      this.document.set(
        value === 'privacy' || value === 'refund' ? value : 'terms',
      );
      this.updateMetadata();
    });
  }

  private updateMetadata() {
    const titles: Record<LegalDocument, string> = {
      terms: 'Terms and Conditions',
      privacy: 'Privacy Policy',
      refund: 'Return, Cancellation and Refund Policy',
    };
    const title = `${titles[this.document()]} | LalganjEats`;
    this.title.setTitle(title);
    this.meta.updateTag({
      name: 'description',
      content: `${titles[this.document()]} for customers, restaurant partners and delivery partners using LalganjEats.`,
    });
  }
}
