import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService, PeriodKey, SeriesData, StudentStats, AttendanceReportItem } from '../../core/services/dashboard.service';
import { ClassStatus, DashboardSummary, RoleName, UpcomingClass } from '../../core/models';
import { statusLabel } from '../../shared/status';
import { Toast } from '../../shared/toast';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state/error-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { SimpleChartComponent, ChartDatum } from '../../shared/components/simple-chart/simple-chart.component';

interface ActivityItem {
  id: string;
  text: string;
  when: string;
}

interface CommissionGroup {
  commission: string;
  subject: string;
  classes: UpcomingClass[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    PageHeaderComponent,
    KpiCardComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LoadingSkeletonComponent,
    SimpleChartComponent,
  ],
  template: `
    <div class="home">
      <app-page-header [title]="headerTitle" [subtitle]="headerSubtitle" [icon]="headerIcon"></app-page-header>

      @if (loading) {
        <app-loading-skeleton variant="card" [rows]="4"></app-loading-skeleton>
      }

      @if (!loading && error) {
        <app-error-state [message]="error" (retry)="load()"></app-error-state>
      }

      @if (!loading && summary) {
        @if (isStaff) {
          <!-- ══════════ DOCENTE: próxima clase + comisiones ══════════ -->
          @if (isDocente) {
            <div class="grid">
              <div class="card">
                <h2 class="card-title">Próxima clase</h2>
                @if (summary.next_class; as nc) {
                  <div class="next-title">{{ nc.subject }} · {{ nc.commission }}</div>
                  <div class="next-meta">{{ nc.title }} · {{ nc.date }}@if (nc.starts_at) { · {{ nc.starts_at }} }@if (nc.classroom) { · {{ nc.classroom }} }</div>
                  <button mat-flat-button color="primary" (click)="goToNextClass()">
                    <mat-icon aria-hidden="true">{{ nc.status === ClassStatus.ACTIVE ? 'visibility' : 'play_arrow' }}</mat-icon>
                    {{ nc.status === ClassStatus.ACTIVE ? 'Ver en vivo' : 'Iniciar clase' }}
                  </button>
                } @else {
                  <app-empty-state icon="event_busy" title="Sin próxima clase" message="Todavía no hay clases programadas."></app-empty-state>
                }
              </div>

              <div class="card">
                <h2 class="card-title">Mis comisiones</h2>
                @if (myCommissions.length) {
                  <div class="group-list">
                    @for (group of myCommissions; track group.commission) {
                      <div class="group">
                        <div class="group-title">{{ group.commission }} · {{ group.subject }}</div>
                        <ul class="plain-list">
                          @for (c of group.classes; track c.id) {
                            <li>
                              <div class="row-sub">{{ c.title }} · {{ c.date }}@if (c.starts_at) { · {{ c.starts_at }} }</div>
                              <app-status-chip [status]="c.status" kind="class"></app-status-chip>
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                } @else {
                  <app-empty-state icon="school" title="Sin comisiones" message="Aún no se registraron clases para tus comisiones."></app-empty-state>
                }
              </div>

              <div class="card">
                <h2 class="card-title">Justificaciones pendientes</h2>
                <div class="big-number" [class.zero]="summary.pending_justifications === 0">{{ summary.pending_justifications }}</div>
                <p class="card-hint">
                  {{ summary.pending_justifications === 0
                    ? 'No hay justificaciones esperando revisión.'
                    : 'Justificación' + (summary.pending_justifications === 1 ? '' : 'es') + ' esperando revisión.' }}
                </p>
              </div>
            </div>
          }

          <!-- ══════════ ADMIN/AUDITOR: KPIs ══════════ -->
          @if (isAdminOrAuditor) {
            <section class="kpis" aria-label="Indicadores">
              <app-kpi-card label="Clases de hoy" [value]="summary.classes_today" icon="event_available" color="primary" route="/admin/classes"></app-kpi-card>
              <app-kpi-card label="Clases activas" [value]="summary.active_classes" icon="record_voice_over" color="success" route="/admin/classes"></app-kpi-card>
              <app-kpi-card label="Asistencia promedio" [value]="attendanceToday" icon="percent" color="info" route="/admin/reports"></app-kpi-card>
              <app-kpi-card label="Alumnos en riesgo" [value]="summary.low_attendance_students" icon="warning_amber" color="warning" route="/admin/reports"></app-kpi-card>
              <app-kpi-card label="Justificaciones pendientes" [value]="summary.pending_justifications" icon="fact_check" color="danger" route="/admin/reports"></app-kpi-card>
            </section>
          }

          <!-- ══════════ STAFF: período + gráficos ══════════ -->
          <div class="period-row">
            <mat-button-toggle-group [value]="period" aria-label="Período del gráfico" (change)="onPeriod($event.value)">
              <mat-button-toggle value="today">Hoy</mat-button-toggle>
              <mat-button-toggle value="week">Esta semana</mat-button-toggle>
              <mat-button-toggle value="month">Este mes</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <section class="grid" aria-label="Gráficos y resumen">
            <div class="card card-wide">
              <h2 class="card-title">{{ isDocente ? 'Asistencia semanal' : 'Evolución de asistencia' }}</h2>
              <app-simple-chart type="line" [data]="series.evolution" [height]="220" ariaLabel="Evolución de asistencia en el período seleccionado"></app-simple-chart>
            </div>
            <div class="card card-wide">
              <h2 class="card-title">Distribución presente/tarde/ausente</h2>
              <app-simple-chart type="donut" [data]="series.distribution" [height]="220" ariaLabel="Distribución de estados de asistencia"></app-simple-chart>
            </div>

            @if (isAdminOrAuditor) {
              <div class="card">
                <h2 class="card-title">Próximas clases</h2>
                @if (summary.upcoming_classes.length) {
                  <ul class="plain-list">
                    @for (c of summary.upcoming_classes; track c.id) {
                      <li>
                        <div class="row-title">{{ c.subject }} · {{ c.commission }}</div>
                        <div class="row-sub">{{ c.title }} · {{ c.date }}@if (c.starts_at) { · {{ c.starts_at }} }@if (c.classroom) { · {{ c.classroom }} }</div>
                        <app-status-chip [status]="c.status" kind="class"></app-status-chip>
                      </li>
                    }
                  </ul>
                } @else {
                  <app-empty-state icon="event_busy" title="Sin clases próximas" message="No hay clases programadas en el corto plazo."></app-empty-state>
                }
              </div>

              <div class="card">
                <h2 class="card-title">Alertas administrativas</h2>
                <ul class="plain-list">
                  <li class="alert-item" [class.muted]="summary.pending_justifications === 0">
                    <mat-icon class="alert-icon" aria-hidden="true">fact_check</mat-icon>
                    <span>{{ summary.pending_justifications }} justificación{{ summary.pending_justifications === 1 ? '' : 'es' }} pendiente{{ summary.pending_justifications === 1 ? '' : 's' }}</span>
                    <a class="alert-link" [routerLink]="'/admin/reports'">Ver</a>
                  </li>
                  <li class="alert-item" [class.muted]="summary.low_attendance_students === 0">
                    <mat-icon class="alert-icon" aria-hidden="true">warning_amber</mat-icon>
                    <span>{{ summary.low_attendance_students }} alumno{{ summary.low_attendance_students === 1 ? '' : 's' }} en riesgo de asistencia</span>
                    <a class="alert-link" [routerLink]="'/admin/reports'">Ver</a>
                  </li>
                </ul>
              </div>
            }
          </section>

          <!-- ══════════ STAFF: riesgo + actividad + accesos ══════════ -->
          <section class="grid" aria-label="Detalle">
            <ng-container *ngTemplateOutlet="riskCard"></ng-container>
            <ng-container *ngTemplateOutlet="activityCard"></ng-container>

            @if (isAdmin) {
              <div class="card">
                <h2 class="card-title">Accesos rápidos</h2>
                <div class="quick-grid">
                  <button mat-stroked-button (click)="go('/admin/students')"><mat-icon aria-hidden="true">person_add</mat-icon> Alumnos</button>
                  <button mat-stroked-button (click)="go('/admin/commissions')"><mat-icon aria-hidden="true">group_work</mat-icon> Comisiones</button>
                  <button mat-stroked-button (click)="go('/admin/classrooms')"><mat-icon aria-hidden="true">meeting_room</mat-icon> Aulas</button>
                  <button mat-stroked-button (click)="go('/admin/classes')"><mat-icon aria-hidden="true">class</mat-icon> Clases</button>
                </div>
              </div>
            }
          </section>
        }

        @if (isStudent) {
          <!-- ══════════ ALUMNO ══════════ -->
          <section class="grid" aria-label="Panel del alumno">
            <div class="card card-cta">
              <h2 class="card-title">Escanear asistencia</h2>
              <p class="card-hint">Escaneá el código QR que muestra el docente en el aula.</p>
              <button mat-flat-button color="primary" class="cta-button" (click)="go('/student/scan')">
                <mat-icon aria-hidden="true">qr_code_scanner</mat-icon>
                Escanear asistencia
              </button>
            </div>

            <div class="card">
              <h2 class="card-title">Próxima clase</h2>
              @if (summary.next_class; as nc) {
                <div class="next-title">{{ nc.subject }} · {{ nc.commission }}</div>
                <div class="next-meta">{{ nc.title }} · {{ nc.date }}@if (nc.starts_at) { · {{ nc.starts_at }} }@if (nc.classroom) { · {{ nc.classroom }} }</div>
              } @else {
                <app-empty-state icon="event_busy" title="Sin próxima clase" message="Todavía no tenés clases programadas."></app-empty-state>
              }
            </div>

            <div class="card card-wide">
              <h2 class="card-title">Mi asistencia</h2>
              @if (studentStats.perSubject.length) {
                <div class="stats-grid">
                  <div class="overall-block">
                    <app-simple-chart type="donut" [data]="overallDonutData" [height]="180" ariaLabel="Porcentaje de asistencia general"></app-simple-chart>
                    <div class="overall-value">{{ studentStats.overall }}%</div>
                  </div>
                  <div class="per-subject-block">
                    <app-simple-chart type="bars" [data]="perSubjectData" [height]="200" ariaLabel="Asistencia por materia"></app-simple-chart>
                  </div>
                </div>
              } @else {
                <app-empty-state icon="fact_check" title="Sin registros de asistencia" message="Todavía no tenés asistencias registradas."></app-empty-state>
              }
            </div>

            <div class="card">
              <h2 class="card-title">Materias en riesgo</h2>
              @if (summary.subjects_at_risk.length) {
                <ul class="plain-list">
                  @for (r of summary.subjects_at_risk; track r.subject) {
                    <li>
                      <div class="row-title">{{ r.subject }} · {{ r.commission }}</div>
                      <div class="risk-pct" [class.warn]="r.attendance_pct < 70" [class.crit]="r.attendance_pct < 50">
                        {{ r.attendance_pct }}%
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <app-empty-state icon="verified_user" title="Sin materias en riesgo" message="Todas tus materias están dentro del margen de asistencia."></app-empty-state>
              }
            </div>

            <div class="card">
              <h2 class="card-title">Últimas asistencias</h2>
              @if (summary.recent_attendance.length) {
                <ul class="plain-list">
                  @for (a of summary.recent_attendance; track a.id) {
                    <li>
                      <div class="row-title">{{ a.class_title }}</div>
                      <div class="row-sub">{{ a.date }}@if (a.check_in_at) { · {{ a.check_in_at }} }</div>
                      <app-status-chip [status]="a.status"></app-status-chip>
                    </li>
                  }
                </ul>
              } @else {
                <app-empty-state icon="history" title="Sin asistencias recientes"></app-empty-state>
              }
            </div>

            <div class="card">
              <h2 class="card-title">Justificaciones</h2>
              <p class="card-hint">¿Tuviste una inasistencia justificable? Podés gestionarla desde el detalle de una inasistencia.</p>
              <button mat-stroked-button (click)="onJustifications()">
                <mat-icon aria-hidden="true">description</mat-icon>
                Ver justificaciones
              </button>
            </div>
          </section>
        }
      }
    </div>

    <ng-template #riskCard>
      <div class="card">
        <h2 class="card-title">Alumnos en riesgo</h2>
        @if (lowAttendance.length) {
          <div class="risk-table">
            <div class="risk-row risk-head">
              <span>Alumno</span>
              <span>Legajo</span>
              <span>Asistencia</span>
            </div>
            @for (r of lowAttendance; track r.student_id) {
              <div class="risk-row">
                <span class="risk-name">{{ r.student_name }}</span>
                <span class="risk-muted">{{ r.registration_number ?? '—' }}</span>
                <span class="risk-pct">{{ r.attendance_rate }}%</span>
              </div>
            }
          </div>
        } @else {
          <app-empty-state icon="verified_user" title="Sin alumnos en riesgo" message="Ningún alumno registra asistencia por debajo del umbral."></app-empty-state>
        }
      </div>
    </ng-template>

    <ng-template #activityCard>
      <div class="card">
        <h2 class="card-title">Actividad reciente</h2>
        @if (activity.length) {
          <ul class="plain-list">
            @for (act of activity; track act.id) {
              <li class="activity-item">
                <span class="activity-dot" aria-hidden="true"></span>
                <div class="activity-text">
                  <div class="row-title">{{ act.text }}</div>
                  <div class="row-sub">{{ act.when }}</div>
                </div>
              </li>
            }
          </ul>
        } @else {
          <app-empty-state icon="history" title="Sin actividad reciente" message="Aún no hay eventos registrados."></app-empty-state>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .home {
      display: grid;
      gap: 20px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
    }
    .period-row {
      display: flex;
      justify-content: flex-end;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      align-items: stretch;
    }
    .card {
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      padding: 20px;
      min-width: 0;
    }
    .card-title {
      margin: 0 0 16px;
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-hint {
      margin: 0 0 16px;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
      line-height: 1.5;
    }
    @media (min-width: 900px) {
      .card-wide {
        grid-column: span 2;
      }
    }
    .card-cta {
      display: flex;
      flex-direction: column;
    }
    .cta-button {
      margin-top: auto;
      align-self: flex-start;
    }
    .big-number {
      font-size: var(--fs-kpi);
      font-weight: 700;
      color: var(--color-warning);
      line-height: 1.1;
    }
    .big-number.zero {
      color: var(--text-tertiary);
    }
    .next-title {
      font-weight: 600;
      font-size: var(--fs-body);
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .next-meta {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .plain-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 14px;
    }
    .plain-list li {
      display: grid;
      gap: 4px;
    }
    .row-title {
      font-size: var(--fs-body);
      font-weight: 500;
      color: var(--text-primary);
    }
    .row-sub {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .group-list {
      display: grid;
      gap: 16px;
    }
    .group-title {
      font-weight: 600;
      font-size: var(--fs-body);
      color: var(--color-primary-600);
      margin-bottom: 8px;
    }
    .alert-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--fs-body);
      color: var(--text-primary);
    }
    .alert-item.muted {
      color: var(--text-tertiary);
    }
    .alert-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-warning);
      flex: none;
    }
    .alert-item.muted .alert-icon {
      color: var(--text-tertiary);
    }
    .alert-link {
      margin-left: auto;
      color: var(--color-primary-600);
      text-decoration: none;
      font-weight: 600;
    }
    .alert-link:hover {
      text-decoration: underline;
    }
    .risk-table {
      display: grid;
    }
    .risk-row {
      display: grid;
      grid-template-columns: 1fr 90px 90px;
      gap: 12px;
      align-items: center;
      padding: 10px 4px;
      border-bottom: 1px solid var(--border-color);
      font-size: var(--fs-caption);
    }
    .risk-row:last-child {
      border-bottom: none;
    }
    .risk-head {
      font-weight: 600;
      color: var(--text-secondary);
      padding-top: 0;
    }
    .risk-name {
      font-weight: 500;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .risk-muted {
      color: var(--text-tertiary);
    }
    .risk-pct {
      text-align: right;
      font-weight: 600;
      color: var(--color-danger);
    }
    .risk-pct.warn {
      color: var(--color-warning);
    }
    .risk-pct.crit {
      color: var(--color-danger);
    }
    .activity-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .activity-dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-primary-500);
      margin-top: 6px;
    }
    .activity-text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .quick-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .quick-grid button {
      justify-content: flex-start;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: minmax(180px, 260px) 1fr;
      gap: 24px;
      align-items: center;
    }
    @media (max-width: 700px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
    .overall-block {
      position: relative;
    }
    .overall-value {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--fs-kpi);
      font-weight: 700;
      color: var(--text-primary);
      pointer-events: none;
    }
    .per-subject-block {
      min-width: 0;
    }
  `,
})
export class HomeComponent implements OnInit {
  readonly ClassStatus = ClassStatus;

  summary: DashboardSummary | null = null;
  lowAttendance: AttendanceReportItem[] = [];
  series: SeriesData = { evolution: [], distribution: [] };
  studentStats: StudentStats = { overall: 0, perSubject: [] };
  activity: ActivityItem[] = [];
  period: PeriodKey = 'today';
  loading = true;
  error = '';

  constructor(
    private auth: AuthService,
    private dashboard: DashboardService,
    private router: Router,
    private toast: Toast,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (this.isDocente) {
      this.period = 'week';
    }
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();
    try {
      this.summary = await this.dashboard.loadSummary();
      if (this.isStaff) {
        await this.loadSeries();
        this.lowAttendance = await this.dashboard.loadLowAttendance();
      }
      if (this.isStudent) {
        this.studentStats = await this.dashboard.loadStudentStats();
      }
      this.buildActivity();
    } catch {
      this.error = 'No se pudo cargar el panel.';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async onPeriod(period: PeriodKey): Promise<void> {
    this.period = period;
    await this.loadSeries();
  }

  async loadSeries(): Promise<void> {
    this.series = await this.dashboard.loadSeries(this.period);
    this.cdr.markForCheck();
  }

  // ── Roles ────────────────────────────────────────────────
  get isAdmin(): boolean {
    return this.auth.hasAnyRole(RoleName.ADMIN);
  }
  get isAuditor(): boolean {
    return this.auth.hasAnyRole(RoleName.AUDITOR);
  }
  get isDocente(): boolean {
    return this.auth.hasAnyRole(RoleName.DOCENTE);
  }
  get isStudent(): boolean {
    return this.auth.hasAnyRole(RoleName.ALUMNO);
  }
  get isStaff(): boolean {
    return this.isAdmin || this.isAuditor || this.isDocente;
  }
  get isAdminOrAuditor(): boolean {
    return this.isAdmin || this.isAuditor;
  }

  // ── Encabezado ───────────────────────────────────────────
  get headerTitle(): string {
    return this.greeting;
  }
  get headerSubtitle(): string {
    const fecha = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
    return `Este es el resumen de asistencia del ${fecha}.`;
  }
  get headerIcon(): string {
    if (this.isAdmin) {
      return 'space_dashboard';
    }
    if (this.isAuditor) {
      return 'visibility';
    }
    if (this.isDocente) {
      return 'school';
    }
    return 'person';
  }
  get greeting(): string {
    const hour = new Date().getHours();
    const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const name = this.auth.getUser()?.full_name?.split(' ')[0] ?? '';
    return name ? `${saludo}, ${name}` : saludo;
  }

  // ── Docente ──────────────────────────────────────────────
  get attendanceToday(): number | null {
    return this.summary?.attendance_rate_today ?? null;
  }

  get myCommissions(): CommissionGroup[] {
    const groups = new Map<string, CommissionGroup>();
    for (const c of this.summary?.upcoming_classes ?? []) {
      const key = c.commission || c.subject;
      const existing = groups.get(key);
      if (existing) {
        existing.classes.push(c);
      } else {
        groups.set(key, { commission: key, subject: c.subject, classes: [c] });
      }
    }
    return Array.from(groups.values());
  }

  goToNextClass(): void {
    const nc = this.summary?.next_class;
    if (nc?.id) {
      this.go(`/admin/classes/${nc.id}`);
    }
  }

  // ── Alumno ───────────────────────────────────────────────
  get overallDonutData(): ChartDatum[] {
    const overall = this.studentStats.overall;
    return [
      { label: 'Asistencia', value: overall },
      { label: 'Inasistencias', value: Math.max(0, 100 - overall) },
    ];
  }
  get perSubjectData(): ChartDatum[] {
    return this.studentStats.perSubject.map((s) => ({ label: s.subject, value: s.pct }));
  }

  onJustifications(): void {
    this.toast.success('Podés justificar desde el detalle de una inasistencia');
  }

  // ── Acciones ─────────────────────────────────────────────
  go(path: string): void {
    this.router.navigate([path]);
  }

  private buildActivity(): void {
    const items: ActivityItem[] = [];
    const s = this.summary;
    if (s) {
      for (const a of s.recent_attendance ?? []) {
        items.push({
          id: `att-${a.id}`,
          text: `${a.student_name} · ${a.class_title}`,
          when: `${this.fmtDate(a.date)} · ${statusLabel(a.status)}`,
        });
      }
      if (this.isAdmin || this.isAuditor) {
        for (const ev of s.recent_audit ?? []) {
          items.push({
            id: `aud-${ev.id}`,
            text: ev.action,
            when: `${ev.username ?? ''}${ev.username ? ' · ' : ''}${this.fmtDate(ev.created_at)}`,
          });
        }
      }
    }
    this.activity = items;
  }

  private fmtDate(v: string | null | undefined): string {
    if (!v) {
      return '';
    }
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      return v;
    }
    const datePart = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hasTime = v.includes('T') || v.includes(' ');
    if (!hasTime) {
      return datePart;
    }
    return datePart + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
