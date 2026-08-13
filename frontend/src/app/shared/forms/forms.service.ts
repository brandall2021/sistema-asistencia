import { Injectable } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { FieldConfig } from './form-fields';

@Injectable({ providedIn: 'root' })
export class FormsService {
  buildForm(fields: FieldConfig[], values?: Record<string, unknown>): FormGroup {
    const controls: Record<string, FormControl> = {};
    for (const field of fields) {
      const value = this.normalizeValue(field, values?.[field.key]);
      controls[field.key] = new FormControl(
        { value, disabled: !!field.disabled },
        this.validatorsFor(field),
      );
    }
    return new FormGroup(controls);
  }

  focusFirstError(form: FormGroup, fields: FieldConfig[]): void {
    const firstInvalid = fields.find((field) => form.get(field.key)?.invalid);
    if (!firstInvalid) {
      return;
    }
    const el = document.getElementById(`form-field-${firstInvalid.key}`);
    if (!el) {
      return;
    }
    const focusable = (el instanceof HTMLElement ? (el.querySelector('button, input, textarea, select, [tabindex]') ?? el) : el) as HTMLElement;
    focusable.focus();
  }

  getValue(form: FormGroup, fields: FieldConfig[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const control = form.get(field.key);
      if (!control) {
        continue;
      }
      let value: unknown = control.value;
      switch (field.type) {
        case 'checkbox':
          value = !!value;
          break;
        case 'number':
          value = value === '' || value == null ? null : Number(value);
          break;
        case 'date':
          value = value instanceof Date
            ? this.formatDate(value)
            : value == null || value === ''
              ? null
              : String(value);
          break;
        case 'multiselect':
          value = Array.isArray(value) ? value : [];
          break;
        case 'select':
          value = value == null ? null : value;
          break;
      }
      out[field.key] = value;
    }
    return out;
  }

  private defaultValue(field: FieldConfig): unknown {
    switch (field.type) {
      case 'checkbox':
        return false;
      case 'date':
        return null;
      case 'multiselect':
        return [];
      case 'select':
        return null;
      default:
        return '';
    }
  }

  private normalizeValue(field: FieldConfig, value: unknown): unknown {
    if (field.type !== 'date' || value == null || value === '') {
      return value ?? this.defaultValue(field);
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      }
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? this.defaultValue(field) : parsed;
    }
    return this.defaultValue(field);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private validatorsFor(field: FieldConfig): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.required) {
      validators.push(Validators.required);
    }
    if (field.type === 'email') {
      validators.push((control) => (control.value ? Validators.email(control) : null));
    }
    if (field.type === 'password') {
      validators.push(Validators.minLength(8));
    }
    return validators;
  }
}
