import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Toast } from '../toast';
import { FormDialogData } from './form-fields';
import { FormFieldsComponent } from './form-fields.component';
import { FormPanelBase } from './form-panel-base';
import { FormsService } from './forms.service';

@Component({
  selector: 'app-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormFieldsComponent,
  ],
  template: `
    <div class="form-dialog">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="dialog-header">
          @if (data.icon) {
            <div class="dialog-icon" aria-hidden="true">
              <mat-icon>{{ data.icon }}</mat-icon>
            </div>
          }
          <div class="dialog-heading">
            <h2 class="dialog-title">{{ data.title }}</h2>
            @if (data.subtitle) {
              <p class="dialog-subtitle">{{ data.subtitle }}</p>
            }
          </div>
        </div>

        <div class="dialog-body">
          <app-form-fields [form]="form" [fields]="data.fields"></app-form-fields>
        </div>

        <div class="dialog-actions">
          <button type="button" mat-button (click)="cancel()">Cancelar</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="submitting">
            @if (submitting) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <span>{{ data.submitLabel ?? 'Guardar' }}</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .form-dialog {
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
    }
    .dialog-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    .dialog-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: 24px;
    }
    .dialog-heading {
      min-width: 0;
    }
    .dialog-title {
      margin: 0;
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .dialog-subtitle {
      margin: 4px 0 0;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .dialog-body {
      flex: 1;
      overflow: auto;
      max-height: 58vh;
      padding: 0 24px 8px;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
    }
    .dialog-actions button {
      min-width: 108px;
    }
  `,
})
export class FormDialogComponent extends FormPanelBase {
  constructor(
    dialogRef: MatDialogRef<FormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: FormDialogData,
    forms: FormsService,
    toast: Toast,
  ) {
    super(dialogRef, data, forms, toast);
  }
}
