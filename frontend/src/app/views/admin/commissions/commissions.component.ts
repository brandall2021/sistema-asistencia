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
import { Career, Commission, Subject, Teacher } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Comisiones</mat-card-title>
        <mat-card-subtitle>Agrupaciones de estudiantes por materia, año y cuatrimestre</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nueva comisión</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput [(ngModel)]="form.name" name="name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Código</mat-label><input matInput [(ngModel)]="form.code" name="code" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Materia</mat-label>
            <mat-select [(ngModel)]="form.subject_id" name="subject_id" required>
              <mat-option *ngFor="let s of subjects" [value]="s.id">{{ s.name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Carrera</mat-label>
            <mat-select [(ngModel)]="form.career_id" name="career_id" required>
              <mat-option *ngFor="let c of careers" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Docente</mat-label>
            <mat-select [(ngModel)]="form.teacher_id" name="teacher_id">
              <mat-option *ngFor="let t of teachers" [value]="t.id">{{ t.full_name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Año</mat-label><input matInput [(ngModel)]="form.year" name="year" type="number" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Cuatrimestre</mat-label><input matInput [(ngModel)]="form.period" name="period" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Capacidad</mat-label><input matInput [(ngModel)]="form.capacity" name="capacity" type="number" /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.active" name="active">Activa</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let c">{{ c.name }}</td></ng-container>
          <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Código</th><td mat-cell *matCellDef="let c">{{ c.code }}</td></ng-container>
          <ng-container matColumnDef="subject_name"><th mat-header-cell *matHeaderCellDef>Materia</th><td mat-cell *matCellDef="let c">{{ c.subject_name }}</td></ng-container>
          <ng-container matColumnDef="career_name"><th mat-header-cell *matHeaderCellDef>Carrera</th><td mat-cell *matCellDef="let c">{{ c.career_name }}</td></ng-container>
          <ng-container matColumnDef="teacher_name"><th mat-header-cell *matHeaderCellDef>Docente</th><td mat-cell *matCellDef="let c">{{ c.teacher_name }}</td></ng-container>
          <ng-container matColumnDef="year_period"><th mat-header-cell *matHeaderCellDef>Año/Periodo</th><td mat-cell *matCellDef="let c">{{ c.year }} - {{ c.period }}</td></ng-container>
          <ng-container matColumnDef="capacity"><th mat-header-cell *matHeaderCellDef>Capacidad</th><td mat-cell *matCellDef="let c">{{ c.capacity }}</td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Activa</th><td mat-cell *matCellDef="let c"><mat-icon [style.color]="c.active ? 'green' : 'red'">{{ c.active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let c">
            <button mat-icon-button (click)="edit(c)"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="warn" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
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
export class CommissionsComponent implements OnInit {
  items: Commission[] = [];
  careers: Career[] = [];
  subjects: Subject[] = [];
  teachers: Teacher[] = [];
  columns = ['name', 'code', 'subject_name', 'career_name', 'teacher_name', 'year_period', 'capacity', 'active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { name: '', code: '', subject_id: '', career_id: '', teacher_id: '', year: null, period: '', capacity: null, active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Commission[]>('/commissions');
      this.careers = await this.api.get<Career[]>('/careers');
      this.subjects = await this.api.get<Subject[]>('/subjects');
      this.teachers = await this.api.get<Teacher[]>('/teachers');
    } catch {
      this.toast.error('No se pudieron cargar las comisiones');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name: '', code: '', subject_id: '', career_id: '', teacher_id: '', year: null, period: '', capacity: null, active: true };
    this.formVisible = true;
  }

  edit(c: Commission): void {
    this.editingId = c.id;
    this.form = { name: c.name, code: c.code, subject_id: c.subject_id, career_id: c.career_id, teacher_id: c.teacher_id, year: c.year, period: c.period, capacity: c.capacity, active: c.active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        await this.api.patch(`/commissions/${this.editingId}`, this.form);
        this.toast.success('Comisión actualizada');
      } else {
        await this.api.post('/commissions', this.form);
        this.toast.success('Comisión creada');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(c: Commission): Promise<void> {
    if (!confirm(`¿Eliminar la comisión ${c.name}?`)) return;
    try {
      await this.api.delete(`/commissions/${c.id}`);
      this.toast.success('Comisión eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
