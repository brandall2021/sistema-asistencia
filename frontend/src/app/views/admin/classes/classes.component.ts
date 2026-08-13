import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ClassSession, Commission, ClassStatus } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Clases</mat-card-title>
        <mat-card-subtitle>Planificación, inicio/fin de clase y generación de QR dinámico</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nueva clase</button>
          <mat-form-field appearance="outline" class="filter">
            <mat-label>Filtrar por estado</mat-label>
            <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()">
              <mat-option value="">Todos</mat-option>
              <mat-option [value]="ClassStatus.SCHEDULED">Programada</mat-option>
              <mat-option [value]="ClassStatus.ACTIVE">En curso</mat-option>
              <mat-option [value]="ClassStatus.FINISHED">Finalizada</mat-option>
              <mat-option [value]="ClassStatus.CANCELLED">Cancelada</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Comisión</mat-label>
            <mat-select [(ngModel)]="form.commission_id" name="commission_id" required>
              <mat-option *ngFor="let c of commissions" [value]="c.id">{{ c.name }} ({{ c.subject_name }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Fecha</mat-label><input matInput [(ngModel)]="form.date" name="date" type="date" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Título</mat-label><input matInput [(ngModel)]="form.title" name="title" /></mat-form-field>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">Crear</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="filtered" class="mat-elevation-z2">
          <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let c">{{ c.date }}</td></ng-container>
          <ng-container matColumnDef="commission_name"><th mat-header-cell *matHeaderCellDef>Comisión</th><td mat-cell *matCellDef="let c">{{ c.commission_name }}</td></ng-container>
          <ng-container matColumnDef="subject_name"><th mat-header-cell *matHeaderCellDef>Materia</th><td mat-cell *matCellDef="let c">{{ c.subject_name }}</td></ng-container>
          <ng-container matColumnDef="classroom_name"><th mat-header-cell *matHeaderCellDef>Aula</th><td mat-cell *matCellDef="let c">{{ c.classroom_name || '-' }}</td></ng-container>
          <ng-container matColumnDef="time"><th mat-header-cell *matHeaderCellDef>Horario</th><td mat-cell *matCellDef="let c">{{ c.starts_at || '-' }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let c"><span class="chip" [class.act]="c.status === 'ACTIVE'">{{ c.status }}</span></td></ng-container>
          <ng-container matColumnDef="attendance_count"><th mat-header-cell *matHeaderCellDef>Presentes</th><td mat-cell *matCellDef="let c">{{ c.attendance_count }} / {{ c.total_students }}</td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let c">
            <button mat-icon-button (click)="open(c)"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button color="warn" (click)="remove(c)" *ngIf="c.status === 'SCHEDULED'"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .toolbar { margin: 16px 0; display: flex; gap: 12px; align-items: center; }
    .filter { width: 220px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .actions { display: flex; align-items: center; gap: 8px; }
    table { width: 100%; }
    .chip { background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; }
    .chip.act { background: #dcfce7; color: #166534; }
    .center { display: flex; justify-content: center; padding: 24px; }
  `,
})
export class ClassesComponent implements OnInit {
  items: ClassSession[] = [];
  filtered: ClassSession[] = [];
  commissions: Commission[] = [];
  columns = ['date', 'commission_name', 'subject_name', 'classroom_name', 'time', 'status', 'attendance_count', 'actions'];
  loading = true;
  formVisible = false;
  form: any = { commission_id: '', date: '', title: '' };
  statusFilter = '';
  readonly ClassStatus = ClassStatus;

  constructor(private api: ApiService, private router: Router, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<ClassSession[]>('/classes');
      this.commissions = await this.api.get<Commission[]>('/commissions');
      this.applyFilter();
    } catch {
      this.toast.error('No se pudieron cargar las clases');
    } finally {
      this.loading = false;
    }
  }

  applyFilter(): void {
    this.filtered = this.statusFilter ? this.items.filter((c) => c.status === this.statusFilter) : [...this.items];
  }

  openCreate(): void {
    this.form = { commission_id: '', date: new Date().toISOString().slice(0, 10), title: '' };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
  }

  async save(): Promise<void> {
    try {
      await this.api.post('/classes', this.form);
      this.toast.success('Clase creada');
      this.formVisible = false;
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al crear la clase');
    }
  }

  open(c: ClassSession): void {
    this.router.navigate(['/admin/classes', c.id]);
  }

  async remove(c: ClassSession): Promise<void> {
    if (!confirm(`¿Eliminar la clase del ${c.date}?`)) return;
    try {
      await this.api.delete(`/classes/${c.id}`);
      this.toast.success('Clase eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
