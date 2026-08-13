import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { statusLabel, statusTone } from '../../status';

@Component({
  selector: 'app-status-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <span class="status-chip tone-{{ tone }}" [attr.aria-label]="displayLabel">
      <span class="status-dot" aria-hidden="true"></span>
      {{ displayLabel }}
    </span>
  `,
  styles: `
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: var(--fs-caption);
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }
    .tone-success { color: var(--color-success); background: var(--color-success-bg); }
    .tone-warning { color: var(--color-warning); background: var(--color-warning-bg); }
    .tone-danger { color: var(--color-danger); background: var(--color-danger-bg); }
    .tone-info { color: var(--color-info); background: var(--color-info-bg); }
    .tone-primary { color: var(--color-primary-600); background: var(--color-primary-50); }
    .tone-neutral { color: var(--text-secondary); background: var(--surface-muted); border: 1px solid var(--border-color); }
  `,
})
export class StatusChipComponent {
  @Input() status = '';
  @Input() kind?: 'class';
  @Input() label?: string;

  get tone(): string {
    return statusTone(this.status);
  }

  get displayLabel(): string {
    return this.label ?? statusLabel(this.status, this.kind);
  }
}
