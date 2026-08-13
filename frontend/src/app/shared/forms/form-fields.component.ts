import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { FieldConfig, FieldType } from './form-fields';

@Component({
  selector: 'app-form-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
  ],
  template: `
    <div class="form-fields">
      @for (section of sections; track section) {
        <div class="section">
          @if (section) {
            <h3 class="section-title">{{ section }}</h3>
          }
          <div class="fields-grid">
            @for (field of fieldsOf(section); track field.key) {
              <div class="field" [class.w-half]="field.width === 'half'" [class.w-full]="field.width !== 'half'">
                @if (field.type === 'checkbox') {
                  <mat-checkbox [id]="'form-field-' + field.key" [formControl]="control(field)" color="primary">
                    {{ field.label }}
                    @if (field.required) {
                      <span class="req">*</span>
                    }
                  </mat-checkbox>
                  @if (control(field).touched && control(field).invalid) {
                    <span class="field-error">{{ errorMessage(field) }}</span>
                  }
                } @else {
                  <mat-form-field appearance="outline" class="w-100">
                    <mat-label>
                      {{ field.label }}
                      @if (field.required) {
                        <span class="req">*</span>
                      }
                    </mat-label>
                    @switch (field.type) {
                      @case ('textarea') {
                        <textarea matInput [id]="'form-field-' + field.key" [formControl]="control(field)" [placeholder]="field.placeholder ?? ''" rows="3"></textarea>
                      }
                      @case ('select') {
                        <mat-select [id]="'form-field-' + field.key" [formControl]="control(field)" [placeholder]="field.placeholder ?? ''">
                          <mat-option *ngFor="let option of field.options ?? []" [value]="option.value">{{ option.label }}</mat-option>
                        </mat-select>
                      }
                      @case ('multiselect') {
                        <mat-select [id]="'form-field-' + field.key" [formControl]="control(field)" multiple [placeholder]="field.placeholder ?? ''">
                          <mat-option *ngFor="let option of field.options ?? []" [value]="option.value">{{ option.label }}</mat-option>
                        </mat-select>
                      }
                      @case ('date') {
                        <ng-container>
                          <input matInput [id]="'form-field-' + field.key" [formControl]="control(field)" [matDatepicker]="datepicker" [placeholder]="field.placeholder ?? ''" />
                          <mat-datepicker-toggle matIconSuffix [for]="datepicker"></mat-datepicker-toggle>
                          <mat-datepicker #datepicker></mat-datepicker>
                        </ng-container>
                      }
                      @default {
                        <input matInput [id]="'form-field-' + field.key" [formControl]="control(field)" [type]="inputType(field.type)" [placeholder]="field.placeholder ?? ''" />
                      }
                    }
                    @if (control(field).touched && control(field).invalid) {
                      <mat-error>{{ errorMessage(field) }}</mat-error>
                    }
                  </mat-form-field>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .form-fields {
      width: 100%;
    }
    .section + .section {
      margin-top: 20px;
    }
    .section-title {
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
      font-size: var(--fs-caption);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-tertiary);
    }
    .fields-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 16px;
      row-gap: 4px;
    }
    .field {
      min-width: 0;
    }
    .field.w-half {
      grid-column: span 1;
    }
    .field.w-full {
      grid-column: 1 / -1;
    }
    .w-100 {
      width: 100%;
    }
    .req {
      color: var(--color-danger);
    }
    .field-error {
      display: block;
      margin-top: 4px;
      font-size: var(--fs-caption);
      color: var(--color-danger);
    }
    @media (max-width: 599px) {
      .fields-grid {
        grid-template-columns: 1fr;
      }
      .field.w-half {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class FormFieldsComponent {
  @Input() form!: FormGroup;
  @Input() fields: FieldConfig[] = [];

  get sections(): string[] {
    const seen = new Set<string>();
    const sections: string[] = [];
    for (const field of this.fields) {
      const section = field.section ?? '';
      if (!seen.has(section)) {
        seen.add(section);
        sections.push(section);
      }
    }
    return sections;
  }

  fieldsOf(section: string): FieldConfig[] {
    return this.fields.filter((field) => (field.section ?? '') === section);
  }

  control(field: FieldConfig): FormControl {
    return this.form.get(field.key) as FormControl;
  }

  inputType(type: FieldType): string {
    switch (type) {
      case 'email':
        return 'email';
      case 'password':
        return 'password';
      case 'number':
        return 'number';
      case 'time':
        return 'time';
      default:
        return 'text';
    }
  }

  errorMessage(field: FieldConfig): string {
    const errors = this.control(field).errors;
    if (!errors) {
      return '';
    }
    if (errors['required']) {
      return `${field.label} es obligatorio`;
    }
    if (errors['email']) {
      return 'Ingresa un email válido';
    }
    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }
    return 'Valor inválido';
  }
}
