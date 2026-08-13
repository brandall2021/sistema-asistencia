import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/services/api.service';
import { ClassSession, ClassStatus, Commission } from '../../../core/models';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { FormDialogComponent } from '../../../shared/forms/form-dialog.component';
import { FieldConfig } from '../../../shared/forms/form-fields';
import { Toast } from '../../../shared/toast';

type ViewMode = 'calendar' | 'list';

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  events: ClassSession[];
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - (day - 1));
  return result;
}

function endOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() + (7 - day));
  return result;
}

function sameDate(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function sessionTimestamp(session: ClassSession): number {
  const raw = session.starts_at || `${session.date}T00:00:00`;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? parseDateKey(session.date).getTime() : time;
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function classFormFields(commissions: Commission[]): FieldConfig[] {
  return [
    {
      key: 'commission_id',
      label: 'Comisión',
      type: 'select',
      required: true,
      options: commissions.map((commission) => ({ label: `${commission.name} (${commission.subject_name})`, value: commission.id })),
      width: 'full',
    },
    { key: 'date', label: 'Fecha', type: 'date', required: true, width: 'half' },
    { key: 'title', label: 'Título', type: 'text', placeholder: 'Opcional', width: 'half' },
  ];
}

function toClassPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    commission_id: String(values['commission_id'] ?? ''),
    date: values['date'] instanceof Date ? formatLocalDate(values['date']) : String(values['date'] ?? ''),
    title: String(values['title'] ?? '').trim() || null,
  };
}

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    PageHeaderComponent,
    ResponsiveTableComponent,
    StatusChipComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-header
      title="Clases"
      subtitle="Calendario mensual y listado operativo de clases"
      icon="class"
      [breadcrumbs]="breadcrumbs"
    ></app-page-header>

    <div class="toolbar">
      <mat-button-toggle-group [value]="viewMode" (change)="setViewMode($event.value)">
        <mat-button-toggle value="calendar">
          <mat-icon aria-hidden="true">calendar_month</mat-icon>
          <span>Calendario</span>
        </mat-button-toggle>
        <mat-button-toggle value="list">
          <mat-icon aria-hidden="true">view_list</mat-icon>
          <span>Lista</span>
        </mat-button-toggle>
      </mat-button-toggle-group>

      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-field">
        <mat-label>Estado</mat-label>
        <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
          <mat-option value="all">Todos</mat-option>
          <mat-option [value]="ClassStatus.SCHEDULED">Programada</mat-option>
          <mat-option [value]="ClassStatus.ACTIVE">En curso</mat-option>
          <mat-option [value]="ClassStatus.FINISHED">Finalizada</mat-option>
          <mat-option [value]="ClassStatus.CANCELLED">Cancelada</mat-option>
        </mat-select>
      </mat-form-field>

      <button mat-flat-button color="primary" type="button" (click)="openCreate()" [disabled]="!commissions.length">
        <mat-icon aria-hidden="true">add</mat-icon>
        Nueva clase
      </button>
    </div>

    @if (loading) {
      <div class="center">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (loadError) {
      <app-error-state [message]="loadError" retryLabel="Reintentar" (retry)="load()"></app-error-state>
    } @else {
      @if (viewMode === 'list') {
        @if (filteredItems.length) {
          <app-responsive-table [columns]="columns" [data]="filteredItems" [actionsTemplate]="actionsTpl"></app-responsive-table>
        } @else {
          <app-empty-state
            icon="event_busy"
            title="Sin clases"
            message="No hay clases para los filtros seleccionados."
            actionLabel="Nueva clase"
            (action)="openCreate()"
          ></app-empty-state>
        }
      } @else {
        @if (filteredItems.length) {
          <section class="calendar-shell">
            <div class="calendar-head">
              <button mat-icon-button type="button" (click)="moveMonth(-1)" aria-label="Mes anterior">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <div>
                <h2 class="calendar-title">{{ monthLabel }}</h2>
                <p class="calendar-subtitle">{{ filteredItems.length }} clase{{ filteredItems.length === 1 ? '' : 's' }}</p>
              </div>
              <button mat-icon-button type="button" (click)="moveMonth(1)" aria-label="Mes siguiente">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>

            <div class="calendar-weekdays" aria-hidden="true">
              @for (day of weekdayLabels; track day) {
                <div class="weekday">{{ day }}</div>
              }
            </div>

            <div class="calendar-grid">
              @for (day of calendarDays; track day.dateKey) {
                <div
                  class="day-cell"
                  [class.outside]="!day.inMonth"
                  [class.today]="day.isToday"
                  (click)="day.events[0] && open(day.events[0])"
                >
                  <div class="day-number">{{ day.dayNumber }}</div>
                  <div class="day-events">
                    @for (session of day.events; track session.id) {
                      <button type="button" class="event-pill status-{{ statusTone(session.status) }}" (click)="open(session); $event.stopPropagation()">
                        @if (session.status === ClassStatus.ACTIVE) {
                          <span class="pulse" aria-hidden="true"></span>
                        }
                        <span class="event-time">{{ timeLabel(session) }}</span>
                        <span class="event-main">{{ session.subject_name }}</span>
                        <span class="event-sub">{{ session.commission_name }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        } @else {
          <app-empty-state
            icon="calendar_month"
            title="Sin clases en el mes"
            message="No hay clases que coincidan con el filtro actual."
            actionLabel="Nueva clase"
            (action)="openCreate()"
          ></app-empty-state>
        }
      }
    }

    <ng-template #statusTpl let-row>
      <app-status-chip [status]="row.status" kind="class"></app-status-chip>
    </ng-template>

    <ng-template #attendanceTpl let-row>
      <span class="attendance">{{ row.attendance_count }} / {{ row.total_students }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <div class="row-actions">
        <button mat-stroked-button color="primary" type="button" (click)="open(row)">
          <mat-icon aria-hidden="true">{{ row.status === ClassStatus.SCHEDULED ? 'play_arrow' : 'visibility' }}</mat-icon>
          <span>{{ row.status === ClassStatus.SCHEDULED ? 'Iniciar' : 'Ver' }}</span>
        </button>
        @if (row.status === ClassStatus.SCHEDULED) {
          <button mat-icon-button color="warn" type="button" (click)="remove(row)" aria-label="Eliminar clase programada">
            <mat-icon>delete</mat-icon>
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .filter-field {
      width: 220px;
      max-width: 100%;
    }
    .center {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 240px;
    }
    .calendar-shell {
      display: grid;
      gap: 12px;
      padding: 16px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
    }
    .calendar-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .calendar-head > div {
      text-align: center;
      flex: 1 1 auto;
    }
    .calendar-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-primary);
      text-transform: capitalize;
    }
    .calendar-subtitle {
      margin: 4px 0 0;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .calendar-weekdays,
    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
    }
    .weekday {
      padding: 0 6px;
      color: var(--text-tertiary);
      font-size: var(--fs-caption);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .day-cell {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 8px;
      min-height: 128px;
      padding: 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--surface-card);
      text-align: left;
      cursor: pointer;
      transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .day-cell:hover {
      background: var(--surface-muted);
      border-color: color-mix(in srgb, var(--color-primary-500) 35%, var(--border-color));
      box-shadow: var(--shadow-card);
    }
    .day-cell.outside {
      opacity: 0.45;
      background: color-mix(in srgb, var(--surface-muted) 55%, transparent);
    }
    .day-cell.today {
      border-color: var(--color-primary-500);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary-500) 20%, transparent);
    }
    .day-number {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .day-events {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-content: flex-start;
      min-height: 72px;
    }
    .event-pill {
      display: grid;
      gap: 2px;
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: 12px;
      text-align: left;
      color: #fff;
      cursor: pointer;
      line-height: 1.2;
      font-size: var(--fs-caption);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
    }
    .event-pill:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    }
    .event-pill .event-time {
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .event-pill .event-main {
      font-weight: 600;
    }
    .event-pill .event-sub {
      opacity: 0.9;
      font-size: 0.72rem;
    }
    .status-primary {
      background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    }
    .status-success {
      background: linear-gradient(135deg, #1f9d55, #15803d);
    }
    .status-neutral {
      background: linear-gradient(135deg, #64748b, #475569);
    }
    .status-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    .pulse {
      width: 8px;
      height: 8px;
      margin-top: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.55);
      animation: pulse 2s ease-out infinite;
    }
    .attendance {
      font-weight: 700;
    }
    .row-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    @keyframes pulse {
      0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.45); }
      60% { transform: scale(1); box-shadow: 0 0 0 7px rgba(255, 255, 255, 0); }
      100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
      .day-cell,
      .event-pill {
        transition: none;
      }
    }
    @media (max-width: 899px) {
      .calendar-weekdays,
      .calendar-grid {
        gap: 8px;
      }
      .day-cell {
        min-height: 112px;
      }
    }
    @media (max-width: 599px) {
      .toolbar {
        align-items: stretch;
      }
      .filter-field {
        width: 100%;
      }
      .calendar-shell {
        padding: 12px;
      }
      .calendar-weekdays {
        display: none;
      }
      .calendar-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .day-cell {
        min-height: 104px;
      }
    }
  `,
})
export class ClassesComponent implements OnInit {
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('attendanceTpl', { static: true }) attendanceTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  readonly breadcrumbs = [
    { label: 'Administración', route: '/admin' },
    { label: 'Clases' },
  ];
  readonly weekdayLabels = WEEKDAY_LABELS;
  readonly ClassStatus = ClassStatus;

  items: ClassSession[] = [];
  commissions: Commission[] = [];
  filteredItems: ClassSession[] = [];
  columns: TableColumn[] = [];
  calendarDays: CalendarDay[] = [];
  loading = true;
  loadError = '';
  viewMode: ViewMode = 'list';
  statusFilter = 'all';
  monthCursor = startOfMonth(new Date());

  constructor(
    private api: ApiService,
    private router: Router,
    private dialog: MatDialog,
    private toast: Toast,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'subject_name', header: 'Materia', mobilePrimary: true },
      { key: 'commission_name', header: 'Comisión', mobileSecondary: true },
      { key: 'teacher_name', header: 'Docente' },
      { key: 'classroom_name', header: 'Aula' },
      { key: 'time', header: 'Horario', accessor: (row) => this.scheduleLabel(row as ClassSession) },
      { key: 'status', header: 'Estado', template: this.statusTpl, sortable: false, mobileSecondary: true },
      { key: 'attendance', header: 'Presentes/Inscriptos', template: this.attendanceTpl, sortable: false },
    ];
    void this.load();
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(this.monthCursor);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [classes, commissions] = await Promise.all([
        this.api.get<ClassSession[]>('/classes'),
        this.api.get<Commission[]>('/commissions'),
      ]);
      this.items = classes;
      this.commissions = commissions;
      this.applyFilters();
    } catch {
      this.loadError = 'No se pudieron cargar las clases';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    const filter = this.statusFilter;
    this.filteredItems = filter === 'all' ? [...this.items] : this.items.filter((session) => session.status === filter);
    this.refreshCalendar();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  moveMonth(delta: number): void {
    this.monthCursor = addMonths(this.monthCursor, delta);
    this.refreshCalendar();
  }

  async openCreate(): Promise<void> {
    if (!this.commissions.length) {
      this.toast.error('No hay comisiones disponibles para crear una clase');
      return;
    }

    const ref = this.dialog.open(FormDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      data: {
        title: 'Nueva clase',
        subtitle: 'Seleccioná comisión, fecha y un título opcional',
        icon: 'event_available',
        fields: classFormFields(this.commissions),
        values: {
          commission_id: this.commissions[0]?.id ?? null,
          date: new Date(),
          title: '',
        },
        submitLabel: 'Crear clase',
        submit: async (values: Record<string, unknown>) => {
          const payload = toClassPayload(values);
          await this.api.post('/classes', payload);
          this.toast.success('Clase creada');
        },
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  open(session: ClassSession): void {
    this.router.navigate(['/admin/classes', session.id]);
  }

  async remove(session: ClassSession): Promise<void> {
    if (!confirm(`¿Eliminar la clase del ${session.date}?`)) {
      return;
    }
    try {
      await this.api.delete(`/classes/${session.id}`);
      this.toast.success('Clase eliminada');
      await this.load();
    } catch (error: any) {
      this.toast.error(error?.error?.detail || 'Error al eliminar la clase');
    }
  }

  timeLabel(session: ClassSession): string {
    if (session.starts_at && session.ends_at) {
      return `${formatTime(session.starts_at)}-${formatTime(session.ends_at)}`;
    }
    if (session.starts_at) {
      return formatTime(session.starts_at);
    }
    return '-';
  }

  scheduleLabel(session: ClassSession): string {
    return `${session.date} · ${this.timeLabel(session)}`;
  }

  statusTone(status: ClassStatus | string): 'primary' | 'success' | 'neutral' | 'danger' {
    switch (status) {
      case ClassStatus.ACTIVE:
        return 'success';
      case ClassStatus.FINISHED:
        return 'neutral';
      case ClassStatus.CANCELLED:
        return 'danger';
      default:
        return 'primary';
    }
  }

  private refreshCalendar(): void {
    const first = startOfMonth(this.monthCursor);
    const from = startOfWeek(first);
    const to = endOfWeek(new Date(first.getFullYear(), first.getMonth() + 1, 0));
    const eventsByDate = new Map<string, ClassSession[]>();

    for (const session of this.filteredItems) {
      const day = session.date;
      const list = eventsByDate.get(day) ?? [];
      list.push(session);
      eventsByDate.set(day, list);
    }

    const days: CalendarDay[] = [];
    const cursor = new Date(from);
    const today = new Date();
    while (cursor <= to) {
      const key = dateKey(cursor);
      const inMonth = cursor.getMonth() === this.monthCursor.getMonth() && cursor.getFullYear() === this.monthCursor.getFullYear();
      days.push({
        date: new Date(cursor),
        dateKey: key,
        dayNumber: cursor.getDate(),
        inMonth,
        isToday: sameDate(cursor, today),
        events: inMonth
          ? [...(eventsByDate.get(key) ?? [])].sort((a, b) => sessionTimestamp(a) - sessionTimestamp(b))
          : [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    this.calendarDays = days;
  }
}
