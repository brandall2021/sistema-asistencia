import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { Toast } from '../toast';

interface ChangePasswordForm {
  current_password: FormControl<string>;
  new_password: FormControl<string>;
  confirm: FormControl<string>;
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="password-dialog">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="dialog-header">
          <div class="dialog-icon" aria-hidden="true">
            <mat-icon>key</mat-icon>
          </div>
          <div class="dialog-heading">
            <h2 class="dialog-title">Cambiar contraseña</h2>
            <p class="dialog-subtitle">La nueva contraseña debe tener al menos 8 caracteres.</p>
          </div>
        </div>

        <div class="dialog-body">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Contraseña actual</mat-label>
            <input matInput type="password" formControlName="current_password" autocomplete="current-password" />
            @if (form.controls.current_password.hasError('incorrect') && form.controls.current_password.touched) {
              <mat-error>La contraseña actual es incorrecta.</mat-error>
            }
            @if (form.controls.current_password.hasError('required') && form.controls.current_password.touched) {
              <mat-error>La contraseña actual es obligatoria.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Nueva contraseña</mat-label>
            <input matInput type="password" formControlName="new_password" autocomplete="new-password" />
            @if (form.controls.new_password.hasError('required') && form.controls.new_password.touched) {
              <mat-error>La nueva contraseña es obligatoria.</mat-error>
            }
            @if (form.controls.new_password.hasError('minlength') && form.controls.new_password.touched) {
              <mat-error>Debe tener al menos 8 caracteres.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Confirmar nueva contraseña</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.controls.confirm.hasError('required') && form.controls.confirm.touched) {
              <mat-error>Confirmar la nueva contraseña es obligatorio.</mat-error>
            }
            @if (form.controls.confirm.hasError('mismatch') && form.controls.confirm.touched) {
              <mat-error>Las contraseñas no coinciden.</mat-error>
            }
          </mat-form-field>

          @if (error) {
            <div class="error-box" role="alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ error }}</span>
            </div>
          }
        </div>

        <div class="dialog-actions">
          <button type="button" mat-button (click)="cancel()">Cancelar</button>
          <button type="submit" mat-flat-button color="primary" [disabled]="submitting">
            @if (submitting) {
              <mat-spinner diameter="18"></mat-spinner>
            } @else {
              <span>Guardar</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
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
      padding: 0 24px 8px;
    }
    .full {
      width: 100%;
      margin-bottom: 12px;
    }
    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0 8px;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--color-danger-bg);
      color: var(--color-danger);
      font-size: var(--fs-caption);
    }
    .error-box mat-icon {
      flex: none;
      width: 20px;
      height: 20px;
      font-size: 20px;
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
export class ChangePasswordComponent {
  form: FormGroup<ChangePasswordForm>;
  submitting = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ChangePasswordComponent>,
    private api: ApiService,
    private toast: Toast,
  ) {
    this.form = this.fb.nonNullable.group({
      current_password: this.fb.nonNullable.control('', Validators.required),
      new_password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
      confirm: this.fb.nonNullable.control('', [Validators.required, this.matchingPassword]),
    });
  }

  private matchingPassword(control: AbstractControl<string>): ValidationErrors | null {
    const parent = control.parent;
    if (!parent) {
      return null;
    }
    const newPassword = parent.get('new_password')?.value ?? '';
    return control.value === newPassword ? null : { mismatch: true };
  }

  async submit(): Promise<void> {
    if (this.submitting) {
      return;
    }
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    const { current_password, new_password } = this.form.getRawValue();
    try {
      await this.api.post('/auth/change-password', { current_password, new_password });
      this.toast.success('Contraseña actualizada correctamente');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      const err = e as { error?: { detail?: string } };
      const detail = err?.error?.detail;
      if (detail === 'Contraseña actual incorrecta') {
        this.error = detail;
        this.form.controls.current_password.setErrors({ incorrect: true });
      } else {
        this.error = detail || 'No se pudo cambiar la contraseña.';
      }
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
