import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Career, Student } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Estudiantes</mat-card-title>
        <mat-card-subtitle>Gestión de estudiantes y su carrera</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nuevo estudiante</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nombre completo</mat-label><input matInput [(ngModel)]="form.full_name" name="full_name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput [(ngModel)]="form.email" name="email" type="email" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Usuario</mat-label><input matInput [(ngModel)]="form.username" name="username" required /></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="!editingId"><mat-label>Contraseña</mat-label><input matInput [(ngModel)]="form.password" name="password" type="password" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Legajo</mat-label><input matInput [(ngModel)]="form.registration_number" name="registration_number" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>DNI</mat-label><input matInput [(ngModel)]="form.dni" name="dni" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Carrera</mat-label>
            <mat-select [(ngModel)]="form.career_id" name="career_id" required>
              <mat-option *ngFor="let c of careers" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Año</mat-label><input matInput [(ngModel)]="form.year" name="year" type="number" /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.is_active" name="is_active">Activo</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="full_name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let s">{{ s.full_name }}</td></ng-container>
          <ng-container matColumnDef="registration_number"><th mat-header-cell *matHeaderCellDef>Legajo</th><td mat-cell *matCellDef="let s">{{ s.registration_number }}</td></ng-container>
          <ng-container matColumnDef="dni"><th mat-header-cell *matHeaderCellDef>DNI</th><td mat-cell *matCellDef="let s">{{ s.dni }}</td></ng-container>
          <ng-container matColumnDef="career_name"><th mat-header-cell *matHeaderCellDef>Carrera</th><td mat-cell *matCellDef="let s">{{ s.career_name }}</td></ng-container>
          <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>Email</th><td mat-cell *matCellDef="let s">{{ s.email }}</td></ng-container>
          <ng-container matColumnDef="is_active"><th mat-header-cell *matHeaderCellDef>Activo</th><td mat-cell *matCellDef="let s"><mat-icon [style.color]="s.is_active ? 'green' : 'red'">{{ s.is_active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let s">
            <button mat-icon-button (click)="edit(s)"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="warn" (click)="remove(s)"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `.toolbar { margin: 16px 0; } .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; } .actions { display: flex; align-items: center; gap: 8px; } table { width: 100%; } .center { display: flex; justify-content: center; padding: 24px; }`,
})
export class StudentsComponent implements OnInit {
  items: Student[] = [];
  careers: Career[] = [];
  columns = ['full_name', 'registration_number', 'dni', 'career_name', 'email', 'is_active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { full_name: '', email: '', username: '', password: '', registration_number: '', dni: '', career_id: '', year: null, is_active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Student[]>('/students');
      this.careers = await this.api.get<Career[]>('/careers');
    } catch {
      this.toast.error('No se pudieron cargar los estudiantes');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { full_name: '', email: '', username: '', password: '', registration_number: '', dni: '', career_id: '', year: null, is_active: true };
    this.formVisible = true;
  }

  edit(s: Student): void {
    this.editingId = s.id;
    this.form = { full_name: s.full_name, email: s.email, username: s.username, password: '', registration_number: s.registration_number, dni: s.dni, career_id: s.career_id, year: s.year, is_active: s.is_active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        const body: any = { full_name: this.form.full_name, email: this.form.email, registration_number: this.form.registration_number, dni: this.form.dni, career_id: this.form.career_id, year: this.form.year, is_active: this.form.is_active };
        await this.api.patch(`/students/${this.editingId}`, body);
        this.toast.success('Estudiante actualizado');
      } else {
        await this.api.post('/students', this.form);
        this.toast.success('Estudiante creado');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(s: Student): Promise<void> {
    if (!confirm(`¿Eliminar al estudiante ${s.full_name}?`)) return;
    try {
      await this.api.delete(`/students/${s.id}`);
      this.toast.success('Estudiante eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
