import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface PageAction {
  label: string;
  icon?: string;
  type?: 'flat' | 'raised' | 'stroked' | 'basic';
  color?: 'primary' | 'accent' | 'warn' | '';
  disabled?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <header class="page-header">
      @if (breadcrumbs.length) {
        <nav class="crumbs" aria-label="Migas de pan">
          @for (crumb of breadcrumbs; track $index; let last = $last) {
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
      }

      <div class="head-row">
        <div class="head-text">
          @if (icon) {
            <div class="head-icon" aria-hidden="true">
              <mat-icon>{{ icon }}</mat-icon>
            </div>
          }
          <div>
            <h1 class="page-title">{{ title }}</h1>
            @if (subtitle) {
              <p class="page-subtitle">{{ subtitle }}</p>
            }
          </div>
        </div>

        <div class="head-actions">
          @for (action of secondaryActions; track $index) {
            @switch (action.type ?? 'basic') {
              @case ('flat') {
                <button type="button" mat-flat-button [color]="action.color || null" [disabled]="action.disabled" (click)="actionClick.emit(action)">
                  @if (action.icon) { <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon> }
                  <span>{{ action.label }}</span>
                </button>
              }
              @case ('raised') {
                <button type="button" mat-raised-button [color]="action.color || null" [disabled]="action.disabled" (click)="actionClick.emit(action)">
                  @if (action.icon) { <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon> }
                  <span>{{ action.label }}</span>
                </button>
              }
              @case ('stroked') {
                <button type="button" mat-stroked-button [color]="action.color || null" [disabled]="action.disabled" (click)="actionClick.emit(action)">
                  @if (action.icon) { <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon> }
                  <span>{{ action.label }}</span>
                </button>
              }
              @default {
                <button type="button" mat-button [color]="action.color || null" [disabled]="action.disabled" (click)="actionClick.emit(action)">
                  @if (action.icon) { <mat-icon aria-hidden="true">{{ action.icon }}</mat-icon> }
                  <span>{{ action.label }}</span>
                </button>
              }
            }
          }

          @if (primaryAction) {
            @switch (primaryAction.type ?? 'flat') {
              @case ('raised') {
                <button type="button" mat-raised-button [color]="primaryAction.color || null" [disabled]="primaryAction.disabled" (click)="primaryClick.emit()">
                  <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
                </button>
              }
              @case ('stroked') {
                <button type="button" mat-stroked-button [color]="primaryAction.color || null" [disabled]="primaryAction.disabled" (click)="primaryClick.emit()">
                  <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
                </button>
              }
              @case ('basic') {
                <button type="button" mat-button [color]="primaryAction.color || null" [disabled]="primaryAction.disabled" (click)="primaryClick.emit()">
                  <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
                </button>
              }
              @default {
                <button type="button" mat-flat-button [color]="primaryAction.color || null" [disabled]="primaryAction.disabled" (click)="primaryClick.emit()">
                  <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
                </button>
              }
            }
          }
        </div>
      </div>
    </header>

    <ng-template #primaryContent>
      @if (primaryAction?.loading) {
        <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
      } @else {
        @if (primaryAction?.icon) { <mat-icon aria-hidden="true">{{ primaryAction?.icon }}</mat-icon> }
        <span>{{ primaryAction?.label }}</span>
      }
    </ng-template>
  `,
  styles: `
    .page-header {
      margin-bottom: 24px;
    }
    .crumbs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
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
    .head-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .head-text {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    .head-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    .head-icon mat-icon {
      width: 26px;
      height: 26px;
      font-size: 26px;
    }
    .head-text .page-title {
      margin: 0;
    }
    .head-text .page-subtitle {
      margin: 4px 0 0;
    }
    .head-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .btn-spinner {
      margin-right: 8px;
    }
    @media (max-width: 599px) {
      .head-row {
        flex-direction: column;
        align-items: stretch;
      }
      .head-actions {
        width: 100%;
      }
      .head-actions button {
        flex: 1 1 auto;
      }
    }
  `,
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
  @Input() breadcrumbs: { label: string; route?: string }[] = [];
  @Input() primaryAction?: PageAction;
  @Input() secondaryActions: PageAction[] = [];
  @Output() primaryClick = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<PageAction>();
}
