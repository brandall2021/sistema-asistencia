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
import { Classroom, Commission, Schedule } from '../../../core/models';
import { Toast } from '../../../shared/toast';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Horarios</mat-card-title>
        <mat-card-subtitle>Días y horas de dictado por comisión y aula</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nuevo horario</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Comisión</mat-label>
            <mat-select [(ngModel)]="form.commission_id" name="commission_id" required>
              <mat-option *ngFor="let c of commissions" [value]="c.id">{{ c.name }} ({{ c.subject_name }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Aula</mat-label>
            <mat-select [(ngModel)]="form.classroom_id" name="classroom_id" required>
              <mat-option *ngFor="let c of classrooms" [value]="c.id">{{ c.name }} ({{ c.code }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Día</mat-label>
            <mat-select [(ngModel)]="form.day_of_week" name="day_of_week" required>
              <mat-option *ngFor="let d of days; let i = index" [value]="i">{{ d }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Inicio</mat-label><input matInput [(ngModel)]="form.start_time" name="start_time" type="time" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Fin</mat-label><input matInput [(ngModel)]="form.end_time" name="end_time" type="time" required /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.active" name="active">Activo</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="commission_name"><th mat-header-cell *matHeaderCellDef>Comisión</th><td mat-cell *matCellDef="let s">{{ s.commission_name }}</td></ng-container>
          <ng-container matColumnDef="subject_name"><th mat-header-cell *matHeaderCellDef>Materia</th><td mat-cell *matCellDef="let s">{{ s.subject_name }}</td></ng-container>
          <ng-container matColumnDef="day_of_week"><th mat-header-cell *matHeaderCellDef>Día</th><td mat-cell *matCellDef="let s">{{ days[s.day_of_week] }}</td></ng-container>
          <ng-container matColumnDef="time"><th mat-header-cell *matHeaderCellDef>Horario</th><td mat-cell *matCellDef="let s">{{ s.start_time }} - {{ s.end_time }}</td></ng-container>
          <ng-container matColumnDef="classroom_name"><th mat-header-cell *matHeaderCellDef>Aula</th><td mat-cell *matCellDef="let s">{{ s.classroom_name }} ({{ s.classroom_code }})</td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Activo</th><td mat-cell *matCellDef="let s"><mat-icon [style.color]="s.active ? 'green' : 'red'">{{ s.active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
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
export class SchedulesComponent implements OnInit {
  items: Schedule[] = [];
  commissions: Commission[] = [];
  classrooms: Classroom[] = [];
  days = DAYS;
  columns = ['commission_name', 'subject_name', 'day_of_week', 'time', 'classroom_name', 'active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { commission_id: '', classroom_id: '', day_of_week: 1, start_time: '', end_time: '', active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Schedule[]>('/schedules');
      this.commissions = await this.api.get<Commission[]>('/commissions');
      this.classrooms = await this.api.get<Classroom[]>('/classrooms');
    } catch {
      this.toast.error('No se pudieron cargar los horarios');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { commission_id: '', classroom_id: '', day_of_week: 1, start_time: '', end_time: '', active: true };
    this.formVisible = true;
  }

  edit(s: Schedule): void {
    this.editingId = s.id;
    this.form = { commission_id: s.commission_id, classroom_id: s.classroom_id, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, active: s.active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        await this.api.patch(`/schedules/${this.editingId}`, { classroom_id: this.form.classroom_id, day_of_week: this.form.day_of_week, start_time: this.form.start_time, end_time: this.form.end_time, active: this.form.active });
        this.toast.success('Horario actualizado');
      } else {
        await this.api.post('/schedules', this.form);
        this.toast.success('Horario creado');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(s: Schedule): Promise<void> {
    if (!confirm('¿Eliminar el horario?')) return;
    try {
      await this.api.delete(`/schedules/${s.id}`);
      this.toast.success('Horario eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
