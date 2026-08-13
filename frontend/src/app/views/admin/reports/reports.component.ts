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
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';
import { Commission } from '../../../core/models';
import { Toast } from '../../../shared/toast';

interface ReportRow {
  student_name: string;
  registration_number: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  percentage: number;
  class_date?: string;
  status?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCardModule,
    MatProgressSpinnerModule, MatDividerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Reportes</mat-card-title>
        <mat-card-subtitle>Asistencia por comisión y rendimiento por estudiante</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline" class="filter">
            <mat-label>Comisión</mat-label>
            <mat-select [(ngModel)]="commissionId" (ngModelChange)="loadAll()">
              <mat-option value="">Todas</mat-option>
              <mat-option *ngFor="let c of commissions" [value]="c.id">{{ c.name }} ({{ c.subject_name }})</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter">
            <mat-label>Desde</mat-label>
            <input matInput [(ngModel)]="dateFrom" type="date" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter">
            <mat-label>Hasta</mat-label>
            <input matInput [(ngModel)]="dateTo" type="date" />
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="loadAll()">Aplicar</button>
          <button mat-raised-button (click)="exportCsv()">Exportar CSV</button>
          <button mat-raised-button (click)="exportXlsx()">Exportar XLSX</button>
        </div>

        <h3>Detalle de asistencia</h3>
        <div class="table-wrap">
          <table mat-table [dataSource]="attendanceRows" class="mat-elevation-z2">
            <ng-container matColumnDef="class_date">
              <th mat-header-cell *matHeaderCellDef>Fecha</th>
              <td mat-cell *matCellDef="let r">{{ r.class_date }}</td>
            </ng-container>
            <ng-container matColumnDef="student_name">
              <th mat-header-cell *matHeaderCellDef>Estudiante</th>
              <td mat-cell *matCellDef="let r">{{ r.student_name }}</td>
            </ng-container>
            <ng-container matColumnDef="registration_number">
              <th mat-header-cell *matHeaderCellDef>Legajo</th>
              <td mat-cell *matCellDef="let r">{{ r.registration_number }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Estado</th>
              <td mat-cell *matCellDef="let r">{{ r.status }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="attCols"></tr>
            <tr mat-row *matRowDef="let row; columns: attCols"></tr>
          </table>
        </div>

        <mat-divider class="divider"></mat-divider>

        <h3>Rendimiento por estudiante</h3>
        <div class="table-wrap">
          <table mat-table [dataSource]="lowRows" class="mat-elevation-z2">
            <ng-container matColumnDef="student_name">
              <th mat-header-cell *matHeaderCellDef>Estudiante</th>
              <td mat-cell *matCellDef="let r">{{ r.student_name }}</td>
            </ng-container>
            <ng-container matColumnDef="registration_number">
              <th mat-header-cell *matHeaderCellDef>Legajo</th>
              <td mat-cell *matCellDef="let r">{{ r.registration_number }}</td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Clases</th>
              <td mat-cell *matCellDef="let r">{{ r.total }}</td>
            </ng-container>
            <ng-container matColumnDef="present">
              <th mat-header-cell *matHeaderCellDef>Presente</th>
              <td mat-cell *matCellDef="let r">{{ r.present }}</td>
            </ng-container>
            <ng-container matColumnDef="late">
              <th mat-header-cell *matHeaderCellDef>Tarde</th>
              <td mat-cell *matCellDef="let r">{{ r.late }}</td>
            </ng-container>
            <ng-container matColumnDef="absent">
              <th mat-header-cell *matHeaderCellDef>Ausente</th>
              <td mat-cell *matCellDef="let r">{{ r.absent }}</td>
            </ng-container>
            <ng-container matColumnDef="percentage">
              <th mat-header-cell *matHeaderCellDef>Pct</th>
              <td mat-cell *matCellDef="let r">{{ r.percentage }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="perfCols"></tr>
            <tr mat-row *matRowDef="let row; columns: perfCols"></tr>
          </table>
        </div>

        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
    .filter { width: 220px; }
    h3 { margin: 16px 0 8px; color: #334155; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; }
    .divider { margin: 20px 0; }
    .center { display: flex; justify-content: center; padding: 24px; }
  `,
})
export class ReportsComponent implements OnInit {
  commissions: Commission[] = [];
  commissionId = '';
  dateFrom = '';
  dateTo = '';
  attendanceRows: ReportRow[] = [];
  lowRows: ReportRow[] = [];
  attCols = ['class_date', 'student_name', 'registration_number', 'status'];
  perfCols = ['student_name', 'registration_number', 'total', 'present', 'late', 'absent', 'percentage'];
  loading = true;

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.loadCommissions();
  }

  async loadCommissions(): Promise<void> {
    try {
      this.commissions = await this.api.get<Commission[]>('/commissions');
    } catch {
      /* sin comisiones */
    }
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading = true;
    try {
      this.attendanceRows = await this.api.get<any[]>('/reports/attendance', {
        commission_id: this.commissionId,
        date_from: this.dateFrom,
        date_to: this.dateTo,
      });
    } catch {
      this.attendanceRows = [];
    }
    try {
      this.lowRows = await this.api.get<any[]>('/reports/students/low-attendance', {
        commission_id: this.commissionId,
      });
    } catch {
      this.lowRows = [];
    } finally {
      this.loading = false;
    }
  }

  async exportCsv(): Promise<void> {
    await this.export('csv');
  }

  async exportXlsx(): Promise<void> {
    await this.export('xlsx');
  }

  private async export(format: 'csv' | 'xlsx'): Promise<void> {
    try {
      const params = [`format=${format}`];
      if (this.commissionId) params.push(`commission_id=${this.commissionId}`);
      if (this.dateFrom) params.push(`date_from=${this.dateFrom}`);
      if (this.dateTo) params.push(`date_to=${this.dateTo}`);
      const blob = await this.api.getBlob(`/reports/attendance/export?${params.join('&')}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `asistencia.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('No se pudo exportar el reporte');
    }
  }
}
