import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="empty">
      <mat-icon class="empty-icon" aria-hidden="true">{{ icon }}</mat-icon>
      <h3 class="empty-title">{{ title }}</h3>
      <p *ngIf="message" class="empty-message">{{ message }}</p>
      <button *ngIf="actionLabel" type="button" mat-flat-button color="primary" (click)="action.emit()">
        {{ actionLabel }}
      </button>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      padding: 48px 24px;
    }
    .empty-icon {
      width: 56px;
      height: 56px;
      font-size: 56px;
      color: var(--text-tertiary);
      opacity: 0.6;
    }
    .empty-title {
      margin: 0;
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .empty-message {
      margin: 0;
      max-width: 380px;
      font-size: var(--fs-body);
      color: var(--text-secondary);
    }
    .empty button {
      margin-top: 8px;
    }
  `,
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Sin resultados';
  @Input() message = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
