import { Injectable } from '@angular/core';
import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { FieldConfig } from './form-fields';

@Injectable({ providedIn: 'root' })
export class FormsService {
  buildForm(fields: FieldConfig[], values?: Record<string, unknown>): FormGroup {
    const controls: Record<string, FormControl> = {};
    for (const field of fields) {
      controls[field.key] = new FormControl(
        { value: values?.[field.key] ?? this.defaultValue(field), disabled: !!field.disabled },
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
      case 'multiselect':
        return [];
      case 'select':
        return null;
      default:
        return '';
    }
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
