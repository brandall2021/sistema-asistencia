import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'textarea';

export interface FieldOption {
  label: string;
  value: string | number | boolean;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: FieldOption[];
  placeholder?: string;
  disabled?: boolean;
  section?: string;
  width?: 'full' | 'half';
}

export type FormSubmitHandler = (values: Record<string, unknown>) => Promise<unknown> | Observable<unknown>;

export interface FormDialogData {
  title: string;
  subtitle?: string;
  fields: FieldConfig[];
  values?: Record<string, unknown>;
  submitLabel?: string;
  icon?: string;
  submit?: FormSubmitHandler;
}

export interface FormDrawerData {
  title: string;
  subtitle?: string;
  fields: FieldConfig[];
  values?: Record<string, unknown>;
  submitLabel?: string;
  icon?: string;
  submit?: FormSubmitHandler;
}

export interface FormResult {
  form: FormGroup;
  values: Record<string, unknown>;
}
