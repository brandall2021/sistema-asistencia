import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Attendance } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatProgressSpinnerModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Mi asistencia</mat-card-title>
        <mat-card-subtitle>Historial de asistencias registradas</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="date"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let a">{{ a.date }}</td></ng-container>
          <ng-container matColumnDef="subject_name"><th mat-header-cell *matHeaderCellDef>Materia</th><td mat-cell *matCellDef="let a">{{ a.subject_name }}</td></ng-container>
          <ng-container matColumnDef="commission_name"><th mat-header-cell *matHeaderCellDef>Comisión</th><td mat-cell *matCellDef="let a">{{ a.commission_name }}</td></ng-container>
          <ng-container matColumnDef="check_in_at"><th mat-header-cell *matHeaderCellDef>Hora</th><td mat-cell *matCellDef="let a">{{ (a.check_in_at | date:'short') || '-' }}</td></ng-container>
          <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let a"><span class="chip" [class.late]="a.status === 'LATE'">{{ a.status }}</span></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
        <p *ngIf="!loading && items.length === 0" class="empty">Todavía no tenés asistencias registradas.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    table { width: 100%; }
    .chip { background: #dcfce7; color: #166534; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; }
    .chip.late { background: #fef3c7; color: #92400e; }
    .center { display: flex; justify-content: center; padding: 24px; }
    .empty { text-align: center; color: #64748b; padding: 24px; }
  `,
})
export class HistoryComponent implements OnInit {
  items: Attendance[] = [];
  columns = ['date', 'subject_name', 'commission_name', 'check_in_at', 'status'];
  loading = true;

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Attendance[]>('/attendance/me');
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'No se pudo cargar el historial');
    } finally {
      this.loading = false;
    }
  }
}
