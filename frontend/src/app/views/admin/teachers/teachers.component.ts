import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Teacher } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Docentes</mat-card-title>
        <mat-card-subtitle>Gestión de docentes del plantel</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nuevo docente</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nombre completo</mat-label><input matInput [(ngModel)]="form.full_name" name="full_name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput [(ngModel)]="form.email" name="email" type="email" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Usuario</mat-label><input matInput [(ngModel)]="form.username" name="username" required /></mat-form-field>
          <mat-form-field appearance="outline" *ngIf="!editingId"><mat-label>Contraseña</mat-label><input matInput [(ngModel)]="form.password" name="password" type="password" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Legajo</mat-label><input matInput [(ngModel)]="form.employee_number" name="employee_number" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Título</mat-label><input matInput [(ngModel)]="form.title" name="title" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Departamento</mat-label><input matInput [(ngModel)]="form.department" name="department" /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.is_active" name="is_active">Activo</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="full_name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let t">{{ t.full_name }}</td></ng-container>
          <ng-container matColumnDef="employee_number"><th mat-header-cell *matHeaderCellDef>Legajo</th><td mat-cell *matCellDef="let t">{{ t.employee_number }}</td></ng-container>
          <ng-container matColumnDef="title"><th mat-header-cell *matHeaderCellDef>Título</th><td mat-cell *matCellDef="let t">{{ t.title }}</td></ng-container>
          <ng-container matColumnDef="department"><th mat-header-cell *matHeaderCellDef>Departamento</th><td mat-cell *matCellDef="let t">{{ t.department }}</td></ng-container>
          <ng-container matColumnDef="email"><th mat-header-cell *matHeaderCellDef>Email</th><td mat-cell *matCellDef="let t">{{ t.email }}</td></ng-container>
          <ng-container matColumnDef="is_active"><th mat-header-cell *matHeaderCellDef>Activo</th><td mat-cell *matCellDef="let t"><mat-icon [style.color]="t.is_active ? 'green' : 'red'">{{ t.is_active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let t">
            <button mat-icon-button (click)="edit(t)"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="warn" (click)="remove(t)"><mat-icon>delete</mat-icon></button>
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
export class TeachersComponent implements OnInit {
  items: Teacher[] = [];
  columns = ['full_name', 'employee_number', 'title', 'department', 'email', 'is_active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { full_name: '', email: '', username: '', password: '', employee_number: '', title: '', department: '', is_active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Teacher[]>('/teachers');
    } catch {
      this.toast.error('No se pudieron cargar los docentes');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { full_name: '', email: '', username: '', password: '', employee_number: '', title: '', department: '', is_active: true };
    this.formVisible = true;
  }

  edit(t: Teacher): void {
    this.editingId = t.id;
    this.form = { full_name: t.full_name, email: t.email, username: t.username, password: '', employee_number: t.employee_number, title: t.title, department: t.department, is_active: t.is_active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        const body: any = { full_name: this.form.full_name, email: this.form.email, employee_number: this.form.employee_number, title: this.form.title, department: this.form.department, is_active: this.form.is_active };
        await this.api.patch(`/teachers/${this.editingId}`, body);
        this.toast.success('Docente actualizado');
      } else {
        await this.api.post('/teachers', this.form);
        this.toast.success('Docente creado');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(t: Teacher): Promise<void> {
    if (!confirm(`¿Eliminar al docente ${t.full_name}?`)) return;
    try {
      await this.api.delete(`/teachers/${t.id}`);
      this.toast.success('Docente eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
