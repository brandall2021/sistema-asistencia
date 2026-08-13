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
import { Career, Subject } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Materias</mat-card-title>
        <mat-card-subtitle>Gestión de materias y planes de estudio</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nueva materia</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput [(ngModel)]="form.name" name="name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Código</mat-label><input matInput [(ngModel)]="form.code" name="code" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Carrera</mat-label>
            <mat-select [(ngModel)]="form.career_id" name="career_id" required>
              <mat-option *ngFor="let c of careers" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Semestre</mat-label><input matInput [(ngModel)]="form.semester" name="semester" type="number" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Créditos</mat-label><input matInput [(ngModel)]="form.credits" name="credits" type="number" /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.active" name="active">Activa</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let s">{{ s.name }}</td></ng-container>
          <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Código</th><td mat-cell *matCellDef="let s">{{ s.code }}</td></ng-container>
          <ng-container matColumnDef="career_name"><th mat-header-cell *matHeaderCellDef>Carrera</th><td mat-cell *matCellDef="let s">{{ s.career_name }}</td></ng-container>
          <ng-container matColumnDef="semester"><th mat-header-cell *matHeaderCellDef>Semestre</th><td mat-cell *matCellDef="let s">{{ s.semester }}</td></ng-container>
          <ng-container matColumnDef="credits"><th mat-header-cell *matHeaderCellDef>Créditos</th><td mat-cell *matCellDef="let s">{{ s.credits }}</td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Activa</th><td mat-cell *matCellDef="let s"><mat-icon [style.color]="s.active ? 'green' : 'red'">{{ s.active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
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
export class SubjectsComponent implements OnInit {
  items: Subject[] = [];
  careers: Career[] = [];
  columns = ['name', 'code', 'career_name', 'semester', 'credits', 'active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { name: '', code: '', career_id: '', semester: null, credits: null, active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Subject[]>('/subjects');
      this.careers = await this.api.get<Career[]>('/careers');
    } catch {
      this.toast.error('No se pudieron cargar las materias');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name: '', code: '', career_id: '', semester: null, credits: null, active: true };
    this.formVisible = true;
  }

  edit(s: Subject): void {
    this.editingId = s.id;
    this.form = { name: s.name, code: s.code, career_id: s.career_id, semester: s.semester, credits: s.credits, active: s.active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        await this.api.patch(`/subjects/${this.editingId}`, this.form);
        this.toast.success('Materia actualizada');
      } else {
        await this.api.post('/subjects', this.form);
        this.toast.success('Materia creada');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(s: Subject): Promise<void> {
    if (!confirm(`¿Eliminar la materia ${s.name}?`)) return;
    try {
      await this.api.delete(`/subjects/${s.id}`);
      this.toast.success('Materia eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
