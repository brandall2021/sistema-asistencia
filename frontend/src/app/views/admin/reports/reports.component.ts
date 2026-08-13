import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/services/api.service';
import {
  AttendanceReportItem,
  DashboardService,
  ReportFilters,
  SeriesData,
} from '../../../core/services/dashboard.service';
import { Toast } from '../../../shared/toast';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageAction, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SimpleChartComponent } from '../../../shared/components/simple-chart/simple-chart.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';

const EMPTY_SERIES: SeriesData = { evolution: [], distribution: [] };

interface FilterOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
    LoadingSkeletonComponent,
    PageHeaderComponent,
    SimpleChartComponent,
    StatusChipComponent,
  ],
  template: `
    <div class="reports-page">
      <app-page-header
        title="Reportes"
        subtitle="Asistencia, riesgo y exportación por carrera, materia, comisión y rango de fechas."
        icon="bar_chart"
        [breadcrumbs]="breadcrumbs"
        [secondaryActions]="headerActions"
        (actionClick)="onHeaderAction($event)"
      ></app-page-header>

      <app-filter-bar
        searchPlaceholder="Buscar alumno o legajo"
        [searchValue]="searchTerm"
        (searchValueChange)="searchTerm = $event"
        [resultCount]="filteredLowAttendance.length"
        [activeFilters]="activeFilters"
        [primaryAction]="applyAction"
        (primaryClick)="applyFilters()"
        (clearFilters)="resetFilters()"
      >
        <mat-form-field appearance="outline" class="filter-field filter-field--wide" subscriptSizing="dynamic">
          <mat-label>Carrera</mat-label>
          <mat-select [(ngModel)]="selectedCareerId" (ngModelChange)="onCareerChange($event)">
            <mat-option value="">Todas</mat-option>
            @for (career of careers; track career.id) {
              <mat-option [value]="career.id">{{ career.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field filter-field--wide" subscriptSizing="dynamic">
          <mat-label>Materia</mat-label>
          <mat-select [(ngModel)]="selectedSubjectId" (ngModelChange)="onSubjectChange($event)">
            <mat-option value="">Todas</mat-option>
            @for (subject of availableSubjects; track subject.id) {
              <mat-option [value]="subject.id">{{ subject.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field filter-field--wide" subscriptSizing="dynamic">
          <mat-label>Comisión</mat-label>
          <mat-select [(ngModel)]="selectedCommissionId">
            <mat-option value="">Todas</mat-option>
            @for (commission of availableCommissions; track commission.id) {
              <mat-option [value]="commission.id">{{ commission.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field filter-field--date" subscriptSizing="dynamic">
          <mat-label>Desde</mat-label>
          <input matInput [(ngModel)]="dateFrom" type="date" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field filter-field--date" subscriptSizing="dynamic">
          <mat-label>Hasta</mat-label>
          <input matInput [(ngModel)]="dateTo" type="date" />
        </mat-form-field>
      </app-filter-bar>

      @if (activeFilters) {
        <p class="active-filters" aria-live="polite">
          <mat-icon aria-hidden="true">filter_alt</mat-icon>
          <span>{{ activeFilters }} filtro{{ activeFilters === 1 ? '' : 's' }} activo{{ activeFilters === 1 ? '' : 's' }}</span>
        </p>
      }

      @if (loading) {
        <app-loading-skeleton variant="card" [rows]="4"></app-loading-skeleton>
      } @else {
        <section class="kpi-grid" aria-label="Indicadores del período">
          <app-kpi-card label="Asistencia" [value]="attendanceKpi" icon="percent" color="info"></app-kpi-card>
          <app-kpi-card label="Presentes" [value]="presentTotal" icon="how_to_reg" color="success"></app-kpi-card>
          <app-kpi-card label="Tarde" [value]="lateTotal" icon="schedule" color="warning"></app-kpi-card>
          <app-kpi-card label="Ausentes" [value]="absentTotal" icon="person_off" color="danger"></app-kpi-card>
        </section>

        <section class="chart-grid">
          <article class="panel panel-wide">
            <div class="panel-head">
              <div>
                <h2>Evolución de asistencia</h2>
                <p>{{ windowLabel }}</p>
              </div>
            </div>

            @if (series.evolution.length) {
              <app-simple-chart
                type="line"
                [data]="series.evolution"
                [height]="240"
                ariaLabel="Evolución de asistencia del período seleccionado"
              ></app-simple-chart>
            } @else {
              <app-empty-state
                icon="insights"
                title="Sin datos para graficar"
                message="No hay clases registradas dentro del rango seleccionado."
              ></app-empty-state>
            }
          </article>

          <article class="panel panel-wide">
            <div class="panel-head">
              <div>
                <h2>Distribución del período</h2>
                <p>Presente, tarde, ausente y justificada.</p>
              </div>
            </div>

            @if (series.distribution.length) {
              <app-simple-chart
                type="donut"
                [data]="series.distribution"
                [height]="240"
                ariaLabel="Distribución de estados de asistencia del período seleccionado"
              ></app-simple-chart>
            } @else {
              <app-empty-state
                icon="donut_large"
                title="Sin distribución disponible"
                message="Ajustá los filtros para ver el detalle por estado."
              ></app-empty-state>
            }
          </article>
        </section>

        <section class="panel table-panel">
          <div class="panel-head panel-head--split">
            <div>
              <h2>Alumnos con baja asistencia</h2>
              <p>Solo muestra estudiantes por debajo del umbral del reporte.</p>
            </div>
            <span class="panel-meta">{{ filteredLowAttendance.length }} resultados</span>
          </div>

          @if (filteredLowAttendance.length) {
            <div class="table-wrap">
              <table class="report-table">
                <thead>
                  <tr>
                    <th scope="col">Alumno</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Desglose</th>
                    <th scope="col">Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredLowAttendance; track row.student_id) {
                    <tr>
                      <td>
                        <div class="student-cell">
                          <strong>{{ row.student_name || 'Sin nombre' }}</strong>
                          <span>Legajo {{ row.registration_number || '—' }} · {{ row.total_classes }} clases</span>
                        </div>
                      </td>
                      <td>
                        <div class="status-cell">
                          <app-status-chip [status]="riskStatus(row.attendance_rate)" [label]="riskLabel(row.attendance_rate)"></app-status-chip>
                          <span class="status-note">{{ formatPercent(row.attendance_rate) }}</span>
                        </div>
                      </td>
                      <td>
                        <div class="breakdown-chip-list">
                          <app-status-chip status="PRESENT" [label]="'P ' + row.present"></app-status-chip>
                          <app-status-chip status="LATE" [label]="'T ' + row.late"></app-status-chip>
                          <app-status-chip status="ABSENT" [label]="'A ' + row.absent"></app-status-chip>
                          <app-status-chip status="JUSTIFIED" [label]="'J ' + row.justified"></app-status-chip>
                        </div>
                      </td>
                      <td>
                        <div class="progress-cell">
                          <div class="progress-head">
                            <strong>{{ formatPercent(row.attendance_rate) }}</strong>
                            <span>{{ row.present + row.late + row.absent + row.justified }} registros</span>
                          </div>
                          <div
                            class="progress-track"
                            [class.is-danger]="progressTone(row.attendance_rate) === 'danger'"
                            [class.is-warning]="progressTone(row.attendance_rate) === 'warning'"
                            [class.is-success]="progressTone(row.attendance_rate) === 'success'"
                            role="progressbar"
                            [attr.aria-valuenow]="roundPercent(row.attendance_rate)"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            [attr.aria-label]="progressLabel(row)"
                          >
                            <div class="progress-fill" [style.width.%]="clampPercent(row.attendance_rate)"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <app-empty-state
              icon="trending_down"
              [title]="emptyLowTitle"
              [message]="emptyLowMessage"
            ></app-empty-state>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .reports-page {
      display: grid;
      gap: 20px;
    }
    .filter-field {
      width: 220px;
    }
    .filter-field--wide {
      width: 260px;
    }
    .filter-field--date {
      width: 180px;
    }
    .active-filters {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0 0;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .active-filters mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--color-primary-600);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .panel {
      padding: 18px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .panel-wide {
      min-width: 0;
    }
    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .panel-head h2 {
      margin: 0;
      font-size: var(--fs-card-title);
    }
    .panel-head p {
      margin: 4px 0 0;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .panel-head--split {
      align-items: center;
    }
    .panel-meta {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .table-panel {
      display: grid;
      gap: 12px;
    }
    .table-wrap {
      overflow-x: auto;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 920px;
    }
    .report-table th,
    .report-table td {
      padding: 14px 12px;
      border-bottom: 1px solid var(--border-color);
      vertical-align: top;
    }
    .report-table th {
      color: var(--text-secondary);
      font-size: var(--fs-caption);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
    }
    .report-table tbody tr:hover {
      background: var(--surface-muted);
    }
    .student-cell {
      display: grid;
      gap: 4px;
    }
    .student-cell strong {
      font-size: var(--fs-body);
      color: var(--text-primary);
    }
    .student-cell span,
    .status-note,
    .progress-head span {
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .status-cell {
      display: grid;
      justify-items: start;
      gap: 8px;
    }
    .breakdown-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .progress-cell {
      display: grid;
      gap: 8px;
      min-width: 220px;
    }
    .progress-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .progress-track {
      position: relative;
      height: 12px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--surface-muted);
      border: 1px solid var(--border-color);
    }
    .progress-track.is-danger {
      --progress-color: var(--color-danger);
    }
    .progress-track.is-warning {
      --progress-color: var(--color-warning);
    }
    .progress-track.is-success {
      --progress-color: var(--color-success);
    }
    .progress-fill {
      height: 100%;
      border-radius: inherit;
      background: var(--progress-color, var(--color-primary-600));
      transition: width var(--dur-fast) var(--ease-out);
    }
    @media (max-width: 1199px) {
      .kpi-grid,
      .chart-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 799px) {
      .kpi-grid,
      .chart-grid {
        grid-template-columns: 1fr;
      }
      .filter-field,
      .filter-field--wide,
      .filter-field--date {
        width: 100%;
      }
    }
  `,
})
export class ReportsComponent implements OnInit {
  careers: FilterOption[] = [];
  subjects: FilterOption[] = [];
  commissions: FilterOption[] = [];

  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Administración' },
    { label: 'Reportes' },
  ];

  selectedCareerId = '';
  selectedSubjectId = '';
  selectedCommissionId = '';
  searchTerm = '';

  private readonly defaultDateFromValue = this.formatDate(this.startOfMonth(new Date()));
  private readonly defaultDateToValue = this.formatDate(new Date());

  dateFrom = this.defaultDateFromValue;
  dateTo = this.defaultDateToValue;

  reportRows: AttendanceReportItem[] = [];
  lowAttendanceRows: AttendanceReportItem[] = [];
  series: SeriesData = EMPTY_SERIES;
  loading = true;

  constructor(
    private api: ApiService,
    private dashboard: DashboardService,
    private toast: Toast,
  ) {}

  ngOnInit(): void {
    void this.loadInitialData();
  }

  get applyAction(): PageAction {
    return { label: 'Aplicar', icon: 'filter_alt', type: 'raised', color: 'primary', disabled: this.loading };
  }

  get headerActions(): PageAction[] {
    return [
      { label: 'Exportar CSV', icon: 'file_download', type: 'stroked', color: 'primary', disabled: this.loading },
      { label: 'Exportar XLSX', icon: 'table_chart', type: 'stroked', color: 'primary', disabled: this.loading },
    ];
  }

  get activeFilters(): number {
    let count = 0;
    if (this.selectedCareerId) count++;
    if (this.selectedSubjectId) count++;
    if (this.selectedCommissionId) count++;
    if (this.dateFrom !== this.defaultDateFromValue) count++;
    if (this.dateTo !== this.defaultDateToValue) count++;
    if (this.searchTerm.trim()) count++;
    return count;
  }

  get availableSubjects(): FilterOption[] {
    return this.subjects;
  }

  get availableCommissions(): FilterOption[] {
    return this.commissions;
  }

  get filteredLowAttendance(): AttendanceReportItem[] {
    const query = this.normalize(this.searchTerm);
    if (!query) {
      return this.lowAttendanceRows;
    }
    return this.lowAttendanceRows.filter((row) => {
      const haystack = [row.student_name, row.registration_number, row.total_classes, row.attendance_rate]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(query);
    });
  }

  get attendanceKpi(): string {
    if (!this.reportRows.length) {
      return '0%';
    }
    return `${this.meanAttendance.toFixed(1)}%`;
  }

  get presentTotal(): number {
    return this.sumRows('present');
  }

  get lateTotal(): number {
    return this.sumRows('late');
  }

  get absentTotal(): number {
    return this.sumRows('absent');
  }

  get windowLabel(): string {
    return `Del ${this.prettyDate(this.dateFrom)} al ${this.prettyDate(this.dateTo)}`;
  }

  get emptyLowTitle(): string {
    return this.searchTerm.trim() ? 'No hay coincidencias' : 'Sin alumnos con baja asistencia';
  }

  get emptyLowMessage(): string {
    return this.searchTerm.trim()
      ? 'Probá con otro nombre o legajo, o limpiá la búsqueda.'
      : 'No se encontraron alumnos por debajo del umbral para los filtros actuales.';
  }

  async onCareerChange(value: string): Promise<void> {
    this.selectedCareerId = value;
  }

  async onSubjectChange(value: string): Promise<void> {
    this.selectedSubjectId = value;
  }

  async applyFilters(): Promise<void> {
    await this.withLoading(() => this.refreshReportData());
  }

  async resetFilters(): Promise<void> {
    this.selectedCareerId = '';
    this.selectedSubjectId = '';
    this.selectedCommissionId = '';
    this.searchTerm = '';
    this.dateFrom = this.defaultDateFromValue;
    this.dateTo = this.defaultDateToValue;
    await this.applyFilters();
  }

  onHeaderAction(action: PageAction): void {
    if (action.icon === 'file_download') {
      void this.export('csv');
    } else if (action.icon === 'table_chart') {
      void this.export('xlsx');
    }
  }

  riskStatus(rate: number): string {
    if (rate < 40) {
      return 'ABSENT';
    }
    if (rate < 60) {
      return 'LATE';
    }
    return 'PRESENT';
  }

  riskLabel(rate: number): string {
    if (rate < 40) {
      return `Crítico ${this.formatPercent(rate)}`;
    }
    if (rate < 60) {
      return `En riesgo ${this.formatPercent(rate)}`;
    }
    return `Seguimiento ${this.formatPercent(rate)}`;
  }

  progressTone(rate: number): 'danger' | 'warning' | 'success' {
    if (rate < 40) {
      return 'danger';
    }
    if (rate < 60) {
      return 'warning';
    }
    return 'success';
  }

  formatPercent(rate: number): string {
    return `${this.clampPercent(rate).toFixed(1)}%`;
  }

  roundPercent(rate: number): number {
    return Math.round(this.clampPercent(rate));
  }

  clampPercent(rate: number): number {
    if (!Number.isFinite(rate)) {
      return 0;
    }
    return Math.max(0, Math.min(100, rate));
  }

  progressLabel(row: AttendanceReportItem): string {
    return `Asistencia de ${row.student_name || 'estudiante'}: ${this.formatPercent(row.attendance_rate)}`;
  }

  private get reportFilters(): ReportFilters {
    return {
      commission_id: this.selectedCommissionId || undefined,
      career_id: this.selectedCareerId || undefined,
      from_date: this.dateFrom || undefined,
      to_date: this.dateTo || undefined,
    };
  }

  private get meanAttendance(): number {
    if (!this.reportRows.length) {
      return 0;
    }
    const total = this.reportRows.reduce((sum, row) => sum + row.attendance_rate, 0);
    return total / this.reportRows.length;
  }

  private sumRows(key: 'present' | 'late' | 'absent'): number {
    return this.reportRows.reduce((sum, row) => sum + row[key], 0);
  }

  private async loadInitialData(): Promise<void> {
    await this.withLoading(async () => {
      const [careers, subjects, commissions, reportRows, lowAttendanceRows, series] = await Promise.all([
        this.loadCareers(),
        this.loadSubjects(),
        this.loadCommissions(),
        this.dashboard.loadAttendanceReport(this.reportFilters),
        this.dashboard.loadLowAttendance(this.reportFilters),
        this.dashboard.loadSeriesRange(this.reportFilters),
      ]);

      this.careers = careers;
      this.subjects = subjects;
      this.commissions = commissions;
      this.reportRows = reportRows;
      this.lowAttendanceRows = lowAttendanceRows;
      this.series = series;
    });
  }

  private async refreshReportData(): Promise<void> {
    const [reportRows, lowAttendanceRows, series] = await Promise.all([
      this.dashboard.loadAttendanceReport(this.reportFilters),
      this.dashboard.loadLowAttendance(this.reportFilters),
      this.dashboard.loadSeriesRange(this.reportFilters),
    ]);

    this.reportRows = reportRows;
    this.lowAttendanceRows = lowAttendanceRows;
    this.series = series;
  }

  private async loadCareers(): Promise<FilterOption[]> {
    try {
      const rows = await this.api.get<Array<{ key: string; label: string | null }>>('/reports/attendance', { dimension: 'career' });
      return rows.map((row) => ({ id: row.key, name: row.label || 'Sin nombre' }));
    } catch {
      return [];
    }
  }

  private async loadSubjects(): Promise<FilterOption[]> {
    try {
      const rows = await this.api.get<Array<{ key: string; label: string | null }>>('/reports/attendance', { dimension: 'subject' });
      return rows.map((row) => ({ id: row.key, name: row.label || 'Sin nombre' }));
    } catch {
      return [];
    }
  }

  private async loadCommissions(): Promise<FilterOption[]> {
    try {
      const rows = await this.api.get<Array<{ key: string; label: string | null }>>('/reports/attendance', { dimension: 'commission' });
      return rows.map((row) => ({ id: row.key, name: row.label || 'Sin nombre' }));
    } catch {
      return [];
    }
  }

  private async export(format: 'csv' | 'xlsx'): Promise<void> {
    try {
      const blob = await this.api.getBlob(`${this.exportPath(format)}?${this.exportQuery(format)}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `asistencia_student.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.toast.error('No se pudo exportar el reporte');
    }
  }

  private exportPath(_: 'csv' | 'xlsx'): string {
    return '/reports/attendance/export';
  }

  private exportQuery(format: 'csv' | 'xlsx'): string {
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('dimension', 'student');
    if (this.selectedCommissionId) params.set('commission_id', this.selectedCommissionId);
    if (this.selectedCareerId) params.set('career_id', this.selectedCareerId);
    if (this.dateFrom) params.set('from_date', this.dateFrom);
    if (this.dateTo) params.set('to_date', this.dateTo);
    return params.toString();
  }

  private async withLoading(task: () => Promise<void>): Promise<void> {
    this.loading = true;
    try {
      await task();
    } finally {
      this.loading = false;
    }
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private prettyDate(value: string): string {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return value;
    }
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
