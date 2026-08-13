import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Commission, Enrollment, Student } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-enrollments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Inscripciones</mat-card-title>
        <mat-card-subtitle>Estudiantes inscritos en comisiones</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nueva inscripción</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Estudiante</mat-label>
            <mat-select [(ngModel)]="form.student_id" name="student_id" required>
              <mat-option *ngFor="let s of students" [value]="s.id">{{ s.full_name }} ({{ s.registration_number }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Comisión</mat-label>
            <mat-select [(ngModel)]="form.commission_id" name="commission_id" required>
              <mat-option *ngFor="let c of commissions" [value]="c.id">{{ c.name }} ({{ c.subject_name }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Estado</mat-label>
            <mat-select [(ngModel)]="form.status" name="status">
              <mat-option value="ACTIVE">ACTIVE</mat-option>
              <mat-option value="INACTIVE">INACTIVE</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Inscribir' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="student_full_name"><th mat-header-cell *matHeaderCellDef>Estudiante</th><td mat-cell *matCellDef="let e">{{ e.student_full_name }}</td></ng-container>
          <ng-container matColumnDef="registration_number"><th mat-header-cell *matHeaderCellDef>Legajo</th><td mat-cell *matCellDef="let e">{{ e.registration_number }}</td></ng-container>
          <ng-container matColumnDef="commission_name"><th mat-header-cell *matHeaderCellDef>Comisión</th><td mat-cell *matCellDef="let e">{{ e.commission_name }}</td></ng-container>
          <ng-container matColumnDef="subject_name"><th mat-header-cell *matHeaderCellDef>Materia</th><td mat-cell *matCellDef="let e">{{ e.subject_name }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let e"><span class="chip">{{ e.status }}</span></td></ng-container>
          <ng-container matColumnDef="enrolled_at"><th mat-header-cell *matHeaderCellDef>Inscrito</th><td mat-cell *matCellDef="let e">{{ e.enrolled_at | date:'short' }}</td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let e">
            <button mat-icon-button color="warn" (click)="remove(e)"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `.toolbar { margin: 16px 0; } .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; } .actions { display: flex; align-items: center; gap: 8px; } table { width: 100%; } .chip { background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; } .center { display: flex; justify-content: center; padding: 24px; }`,
})
export class EnrollmentsComponent implements OnInit {
  items: Enrollment[] = [];
  students: Student[] = [];
  commissions: Commission[] = [];
  columns = ['student_full_name', 'registration_number', 'commission_name', 'subject_name', 'status', 'enrolled_at', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { student_id: '', commission_id: '', status: 'ACTIVE' };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Enrollment[]>('/enrollments');
      this.students = await this.api.get<Student[]>('/students');
      this.commissions = await this.api.get<Commission[]>('/commissions');
    } catch {
      this.toast.error('No se pudieron cargar las inscripciones');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { student_id: '', commission_id: '', status: 'ACTIVE' };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      await this.api.post('/enrollments', this.form);
      this.toast.success('Inscripción creada');
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al inscribir');
    }
  }

  async remove(e: Enrollment): Promise<void> {
    if (!confirm(`¿Eliminar la inscripción de ${e.student_full_name}?`)) return;
    try {
      await this.api.delete(`/enrollments/${e.id}`);
      this.toast.success('Inscripción eliminada');
      await this.load();
    } catch (err: any) {
      this.toast.error(err?.error?.detail || 'Error al eliminar');
    }
  }
}
