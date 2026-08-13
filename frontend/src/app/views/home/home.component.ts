import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RoleName, DashboardSummary } from '../../core/models';
import { statusClass as statusClassFn } from '../../shared/status';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="dashboard">
      <header class="page-head">
        <h1>Inicio</h1>
        <p>{{ greeting }}</p>
      </header>

      <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>

      <div *ngIf="error" class="error-box">
        <span>{{ error }}</span>
        <button mat-raised-button color="primary" (click)="load()">Reintentar</button>
      </div>

      <div *ngIf="summary" class="grid">
        <mat-card class="kpi">
          <mat-card-title>Clases hoy</mat-card-title>
          <div class="value">{{ summary.classes_today }}</div>
        </mat-card>
        <mat-card class="kpi">
          <mat-card-title>Clases activas</mat-card-title>
          <div class="value">{{ summary.active_classes }}</div>
        </mat-card>
        <mat-card class="kpi">
          <mat-card-title>Asistencia de hoy</mat-card-title>
          <div class="value">{{ summary.attendance_rate_today ?? '—' }}<span *ngIf="summary.attendance_rate_today != null">%</span></div>
        </mat-card>
        <mat-card class="kpi">
          <mat-card-title>Justificaciones pendientes</mat-card-title>
          <div class="value">{{ summary.pending_justifications }}</div>
        </mat-card>
        <mat-card class="kpi" *ngIf="!isStudent()">
          <mat-card-title>Baja asistencia</mat-card-title>
          <div class="value">{{ summary.low_attendance_students }}</div>
        </mat-card>

        <mat-card *ngIf="isStudent()" class="wide scan-card">
          <button mat-fab extended color="primary" (click)="go('/student/scan')">
            <mat-icon>qr_code_scanner</mat-icon>
            Escanear asistencia
          </button>
        </mat-card>

        <mat-card *ngIf="summary.next_class" class="wide">
          <mat-card-title>Próxima clase</mat-card-title>
          <div class="next">
            <div class="title">{{ summary.next_class.subject }} · {{ summary.next_class.commission }}</div>
            <div>{{ summary.next_class.title }} · {{ summary.next_class.date }} <span *ngIf="summary.next_class.starts_at">{{ summary.next_class.starts_at }}</span></div>
            <div *ngIf="summary.next_class.classroom">Aula: {{ summary.next_class.classroom }}</div>
          </div>
        </mat-card>

        <mat-card class="wide" *ngIf="summary.upcoming_classes.length">
          <mat-card-title>Próximas clases</mat-card-title>
          <mat-list>
            <mat-list-item *ngFor="let c of summary.upcoming_classes">
              <span matListItemTitle>{{ c.subject }} · {{ c.commission }}</span>
              <span matListItemLine>{{ c.title }} · {{ c.date }} <span *ngIf="c.starts_at">{{ c.starts_at }}</span></span>
            </mat-list-item>
          </mat-list>
        </mat-card>

        <mat-card class="wide" *ngIf="summary.recent_attendance.length">
          <mat-card-title>Asistencia reciente</mat-card-title>
          <mat-list>
            <mat-list-item *ngFor="let a of summary.recent_attendance">
              <span matListItemTitle>{{ a.student_name }} · {{ a.class_title }}</span>
              <span matListItemLine>{{ a.date }} · <span class="chip {{ statusClass(a.status) }}">{{ a.status }}</span></span>
            </mat-list-item>
          </mat-list>
        </mat-card>

        <mat-card class="wide" *ngIf="summary.subjects_at_risk.length">
          <mat-card-title>Materias en riesgo de quedar libre</mat-card-title>
          <mat-list>
            <mat-list-item *ngFor="let r of summary.subjects_at_risk">
              <span matListItemTitle>{{ r.subject }} · {{ r.commission }}</span>
              <span matListItemLine>Asistencia: {{ r.attendance_pct }}%</span>
            </mat-list-item>
          </mat-list>
        </mat-card>

        <mat-card class="wide" *ngIf="summary.recent_audit.length">
          <mat-card-title>Últimos eventos de auditoría</mat-card-title>
          <mat-list>
            <mat-list-item *ngFor="let ev of summary.recent_audit">
              <span matListItemTitle>{{ ev.action }}</span>
              <span matListItemLine>{{ ev.username ?? '' }} · {{ ev.created_at }}</span>
            </mat-list-item>
          </mat-list>
        </mat-card>

        <mat-card class="wide quick-card" *ngIf="isAdmin()">
          <mat-card-title>Accesos rápidos</mat-card-title>
          <div class="quick">
            <button mat-stroked-button color="primary" (click)="go('/admin/students')">
              <mat-icon>person_add</mat-icon> Alumno
            </button>
            <button mat-stroked-button color="primary" (click)="go('/admin/commissions')">
              <mat-icon>group_add</mat-icon> Comisión
            </button>
            <button mat-stroked-button color="primary" (click)="go('/admin/classrooms')">
              <mat-icon>meeting_room</mat-icon> Aula
            </button>
            <button mat-stroked-button color="primary" (click)="go('/admin/classes')">
              <mat-icon>class</mat-icon> Clase
            </button>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: `
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .page-head { margin-bottom: 16px; }
    .page-head h1 { margin: 0 0 4px; font-size: 1.6rem; }
    .page-head p { margin: 0; color: #64748b; }
    .center { display: flex; justify-content: center; padding: 48px 0; }
    .error-box { display: flex; align-items: center; gap: 12px; color: #b91c1c; background: #fee2e2; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .kpi mat-card-title { font-size: 0.9rem; color: #64748b; font-weight: 500; }
    .value { font-size: 2rem; font-weight: 700; margin-top: 8px; }
    .wide { grid-column: 1 / -1; }
    .scan-card { display: flex; align-items: center; justify-content: center; }
    .next .title { font-weight: 600; font-size: 1.1rem; margin-bottom: 4px; }
    .next div { color: #334155; }
    .chip { padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .chip.present { background: #dcfce7; color: #15803d; }
    .chip.late { background: #fef9c3; color: #a16207; }
    .chip.absent { background: #fee2e2; color: #b91c1c; }
    .quick { display: flex; flex-wrap: wrap; gap: 12px; }
    .quick button { display: inline-flex; align-items: center; gap: 6px; }
  `,
})
export class HomeComponent implements OnInit {
  summary: DashboardSummary | null = null;
  loading = true;
  error = '';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.get<DashboardSummary>('/dashboard/summary').then(
      (s) => {
        this.summary = s;
        this.loading = false;
      },
      () => {
        this.error = 'No se pudo cargar el resumen del panel.';
        this.loading = false;
      },
    );
  }

  get greeting(): string {
    if (this.isAdmin() || this.isAuditor()) {
      return 'Panel general de la universidad.';
    }
    if (this.auth.hasAnyRole(RoleName.DOCENTE)) {
      return 'Panel de tus comisiones y clases.';
    }
    return 'Panel de tu asistencia.';
  }

  isAdmin(): boolean {
    return this.auth.hasAnyRole(RoleName.ADMIN);
  }

  isAuditor(): boolean {
    return this.auth.hasAnyRole(RoleName.AUDITOR);
  }

  isStudent(): boolean {
    return this.auth.hasAnyRole(RoleName.ALUMNO);
  }

  go(path: string): void {
    this.router.navigate([path]);
  }

  statusClass(status: string): string {
    return statusClassFn(status);
  }
}
