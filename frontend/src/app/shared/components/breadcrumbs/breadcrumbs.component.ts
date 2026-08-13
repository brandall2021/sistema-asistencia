import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <nav class="crumbs" aria-label="Migas de pan">
      @for (crumb of crumbs; track $index; let last = $last) {
        @if (!last && crumb.route) {
          <a class="crumb-link" [routerLink]="crumb.route">{{ crumb.label }}</a>
        } @else if (!last) {
          <span class="crumb-link crumb-static">{{ crumb.label }}</span>
        } @else {
          <span class="crumb-current" aria-current="page">{{ crumb.label }}</span>
        }
        @if (!last) {
          <mat-icon class="crumb-sep" aria-hidden="true">chevron_right</mat-icon>
        }
      }
    </nav>
  `,
  styles: `
    .crumbs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      font-size: var(--fs-caption);
    }
    .crumb-link {
      color: var(--text-secondary);
      text-decoration: none;
    }
    .crumb-link:hover {
      color: var(--color-primary-600);
      text-decoration: underline;
    }
    .crumb-static {
      color: var(--text-secondary);
    }
    .crumb-current {
      color: var(--text-tertiary);
      font-weight: 500;
    }
    .crumb-sep {
      width: 16px;
      height: 16px;
      font-size: 16px;
      color: var(--text-tertiary);
    }
  `,
})
export class BreadcrumbsComponent {
  @Input() crumbs: { label: string; route?: string }[] = [];
}
