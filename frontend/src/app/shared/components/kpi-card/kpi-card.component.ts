import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <ng-container [ngSwitch]="route ? 'link' : 'plain'">
      <a *ngSwitchCase="'link'" class="kpi-card tone-{{ color }}" [routerLink]="route">
        <ng-container *ngTemplateOutlet="body"></ng-container>
      </a>
      <div *ngSwitchDefault class="kpi-card tone-{{ color }}">
        <ng-container *ngTemplateOutlet="body"></ng-container>
      </div>
    </ng-container>

    <ng-template #body>
      <div *ngIf="icon" class="kpi-icon" aria-hidden="true">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="kpi-body">
        <div class="kpi-label">{{ label }}</div>
        <div *ngIf="loading; else valueBlock" class="skeleton kpi-skeleton"></div>
        <ng-template #valueBlock>
          <div class="kpi-value">{{ value ?? '—' }}</div>
        </ng-template>
      </div>
      <div *ngIf="!loading && trend != null" class="kpi-trend" [class.up]="trend >= 0" [class.down]="trend < 0">
        <span class="kpi-arrow" aria-hidden="true">{{ trend >= 0 ? '↑' : '↓' }}</span>
        <span>{{ trend >= 0 ? '+' : '' }}{{ trend }}%</span>
        <span *ngIf="trendLabel" class="kpi-trend-label">{{ trendLabel }}</span>
      </div>
    </ng-template>
  `,
  styles: `
    .kpi-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      color: var(--text-primary);
      text-decoration: none;
      transition:
        box-shadow var(--dur-fast) var(--ease-out),
        transform var(--dur-fast) var(--ease-out);
    }
    a.kpi-card:hover,
    a.kpi-card:focus-visible {
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
    }
    .kpi-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
    }
    .kpi-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: 24px;
    }
    .tone-primary .kpi-icon { background: var(--color-primary-50); color: var(--color-primary-600); }
    .tone-success .kpi-icon { background: var(--color-success-bg); color: var(--color-success); }
    .tone-warning .kpi-icon { background: var(--color-warning-bg); color: var(--color-warning); }
    .tone-danger .kpi-icon { background: var(--color-danger-bg); color: var(--color-danger); }
    .tone-info .kpi-icon { background: var(--color-info-bg); color: var(--color-info); }
    .tone-neutral .kpi-icon { background: var(--surface-muted); color: var(--text-secondary); }
    .kpi-body {
      flex: 1;
      min-width: 0;
    }
    .kpi-label {
      margin-bottom: 4px;
      font-size: var(--fs-caption);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .kpi-value {
      font-size: var(--fs-kpi);
      font-weight: 700;
      line-height: 1.15;
    }
    .kpi-skeleton {
      width: 72px;
      height: 30px;
      margin-top: 4px;
    }
    .kpi-trend {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      font-size: var(--fs-caption);
      font-weight: 600;
    }
    .kpi-trend.up {
      color: var(--color-success);
    }
    .kpi-trend.down {
      color: var(--color-danger);
    }
    .kpi-trend-label {
      font-weight: 400;
      color: var(--text-tertiary);
    }
  `,
})
export class KpiCardComponent {
  @Input() label = '';
  @Input() value: string | number | null = null;
  @Input() icon = '';
  @Input() color: KpiTone = 'primary';
  @Input() trend: number | null = null;
  @Input() trendLabel = '';
  @Input() loading = false;
  @Input() route = '';
}
