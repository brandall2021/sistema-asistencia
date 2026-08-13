import { Component, ChangeDetectionStrategy, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Observable, of } from 'rxjs';
import { CONFIRM_SUBMITTING } from './confirm-dialog.service';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmIcon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-header" [class.destructive]="data.destructive">
        <div class="confirm-icon" aria-hidden="true">
          <mat-icon>{{ data.destructive ? 'warning' : (data.confirmIcon ?? 'help_outline') }}</mat-icon>
        </div>
        <h2 class="confirm-title">{{ data.title }}</h2>
      </div>
      <p class="confirm-message">{{ data.message }}</p>
      <div class="confirm-actions">
        <button type="button" mat-button data-confirm-cancel (click)="cancel()">
          {{ data.cancelLabel ?? 'Cancelar' }}
        </button>
        <button
          type="button"
          mat-flat-button
          [color]="data.destructive ? 'warn' : 'primary'"
          [disabled]="(submitting$ | async) ?? false"
          (click)="confirm()"
        >
          @if (data.confirmIcon || data.destructive) {
            <mat-icon aria-hidden="true">{{ data.confirmIcon ?? 'delete' }}</mat-icon>
          }
          <span>{{ data.confirmLabel ?? 'Confirmar' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: `
    .confirm-dialog {
      padding: 4px 0;
    }
    .confirm-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .confirm-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    .destructive .confirm-icon {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }
    .confirm-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: 24px;
    }
    .confirm-title {
      margin: 0;
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .confirm-message {
      margin: 16px 0 0;
      font-size: var(--fs-body);
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
  `,
})
export class ConfirmDialogComponent {
  submitting$: Observable<boolean>;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmData,
    @Optional() @Inject(CONFIRM_SUBMITTING) submitting$: Observable<boolean> | null,
  ) {
    this.submitting$ = submitting$ ?? of(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
