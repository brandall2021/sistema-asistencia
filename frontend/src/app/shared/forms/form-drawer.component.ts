import { Component, ChangeDetectionStrategy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Toast } from '../toast';
import { FormDrawerData } from './form-fields';
import { FormFieldsComponent } from './form-fields.component';
import { FormPanelBase } from './form-panel-base';
import { FormsService } from './forms.service';

@Component({
  selector: 'app-form-drawer',
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
    <div class="form-drawer">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="drawer-header">
          <div class="drawer-heading">
            @if (data.icon) {
              <div class="drawer-icon" aria-hidden="true">
                <mat-icon>{{ data.icon }}</mat-icon>
              </div>
            }
            <div class="drawer-heading-text">
              <h2 class="drawer-title">{{ data.title }}</h2>
              @if (data.subtitle) {
                <p class="drawer-subtitle">{{ data.subtitle }}</p>
              }
            </div>
          </div>
          <button type="button" mat-icon-button [attr.aria-label]="'Cerrar'" (click)="cancel()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="drawer-body">
          <app-form-fields [form]="form" [fields]="data.fields"></app-form-fields>
        </div>

        <div class="drawer-actions">
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
    .form-drawer {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 24px 16px;
    }
    .drawer-heading {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .drawer-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    .drawer-icon mat-icon {
      width: 22px;
      height: 22px;
      font-size: 22px;
    }
    .drawer-heading-text {
      min-width: 0;
    }
    .drawer-title {
      margin: 0;
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .drawer-subtitle {
      margin: 4px 0 0;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 24px 16px;
    }
    .drawer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color);
    }
    .drawer-actions button {
      min-width: 108px;
    }
  `,
})
export class FormDrawerComponent extends FormPanelBase {
  constructor(
    dialogRef: MatDialogRef<FormDrawerComponent>,
    @Inject(MAT_DIALOG_DATA) data: FormDrawerData,
    forms: FormsService,
    toast: Toast,
  ) {
    super(dialogRef, data, forms, toast);
  }

  static open(dialog: MatDialog, data: FormDrawerData): MatDialogRef<FormDrawerComponent> {
    return dialog.open(FormDrawerComponent, {
      data,
      panelClass: 'drawer-dialog',
      width: '480px',
      maxWidth: '100vw',
      height: '100%',
    });
  }
}
