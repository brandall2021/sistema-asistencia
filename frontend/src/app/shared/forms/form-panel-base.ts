import { Directive } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable, Subject } from 'rxjs';
import { Toast } from '../toast';
import { FieldConfig, FormSubmitHandler } from './form-fields';
import { FormsService } from './forms.service';

export interface FormPanelData {
  title: string;
  subtitle?: string;
  fields: FieldConfig[];
  values?: Record<string, unknown>;
  submitLabel?: string;
  icon?: string;
  submit?: FormSubmitHandler;
}

@Directive()
export abstract class FormPanelBase {
  readonly form: FormGroup;
  submitting = false;

  protected destroy$ = new Subject<void>();

  constructor(
    protected dialogRef: MatDialogRef<unknown>,
    public readonly data: FormPanelData,
    protected forms: FormsService,
    protected toast: Toast,
  ) {
    this.form = this.forms.buildForm(data.fields, data.values);
  }

  submit(): void {
    if (this.submitting) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.forms.focusFirstError(this.form, this.data.fields);
      return;
    }
    this.submitting = true;
    const values = this.forms.getValue(this.form, this.data.fields);
    const submit = this.data.submit;
    if (!submit) {
      this.dialogRef.close({ form: this.form, values });
      return;
    }
    try {
      const result = submit(values);
      if (result instanceof Observable) {
        result.subscribe({
          next: () => this.onSuccess(values),
          error: (error) => this.onError(error),
        });
      } else if (result) {
        Promise.resolve(result).then(
          () => this.onSuccess(values),
          (error) => this.onError(error),
        );
      } else {
        this.onSuccess(values);
      }
    } catch (error) {
      this.onError(error);
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onSuccess(values: Record<string, unknown>): void {
    this.dialogRef.close({ form: this.form, values });
  }

  protected onError(error: unknown): void {
    this.submitting = false;
    this.toast.error(this.errorDetail(error));
  }

  private errorDetail(error: unknown): string {
    const err = error as { error?: { detail?: string } } | undefined;
    return err?.error?.detail || 'No se pudo guardar. Intenta de nuevo.';
  }
}
