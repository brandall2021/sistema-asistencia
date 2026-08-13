import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/services/api.service';
import { Classroom, Commission, Schedule } from '../../../core/models';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageAction, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';
import { FormDialogComponent } from '../../../shared/forms/form-dialog.component';
import { FieldConfig } from '../../../shared/forms/form-fields';
import { Toast } from '../../../shared/toast';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scheduleFields(commissions: Commission[], classrooms: Classroom[]): FieldConfig[] {
  return [
    {
      key: 'commission_id',
      label: 'Comisión',
      type: 'select',
      required: true,
      options: commissions.map((commission) => ({ label: `${commission.name} - ${commission.subject_name}`, value: commission.id })),
      width: 'full',
    },
    {
      key: 'classroom_id',
      label: 'Aula',
      type: 'select',
      required: true,
      options: classrooms.map((classroom) => ({ label: `${classroom.name} (${classroom.code})`, value: classroom.id })),
      width: 'full',
    },
    {
      key: 'day_of_week',
      label: 'Día',
      type: 'select',
      required: true,
      options: DAYS.map((label, index) => ({ label, value: index })),
      width: 'half',
    },
    { key: 'start_time', label: 'Inicio', type: 'time', required: true, width: 'half' },
    { key: 'end_time', label: 'Fin', type: 'time', required: true, width: 'half' },
    { key: 'active', label: 'Activo', type: 'checkbox', width: 'full' },
  ];
}

function readonlyFields(fields: FieldConfig[]): FieldConfig[] {
  return fields.map((field) => ({ ...field, disabled: true }));
}

function toSchedulePayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    commission_id: String(values['commission_id'] ?? ''),
    classroom_id: String(values['classroom_id'] ?? ''),
    day_of_week: values['day_of_week'] === '' || values['day_of_week'] == null ? null : Number(values['day_of_week']),
    start_time: String(values['start_time'] ?? ''),
    end_time: String(values['end_time'] ?? ''),
    active: !!values['active'],
  };
}

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatMenuModule,
    MatSelectModule,
    PageHeaderComponent,
    FilterBarComponent,
    ResponsiveTableComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Horarios"
      subtitle="Días y horas de dictado por comisión y aula"
      icon="schedule"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por comisión, materia, aula o día"
      [searchValue]="searchTerm"
      (searchValueChange)="searchTerm = $event"
      [resultCount]="filteredItems.length"
      [activeFilters]="activeFilters"
      (clearFilters)="clearFilters()"
      (search)="searchTerm = $event"
    >
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Comisión</mat-label>
        <mat-select [(value)]="commissionFilter">
          <mat-option value="all">Todas</mat-option>
          <mat-option *ngFor="let commission of commissions" [value]="commission.id">{{ commission.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Aula</mat-label>
        <mat-select [(value)]="classroomFilter">
          <mat-option value="all">Todas</mat-option>
          <mat-option *ngFor="let classroom of classrooms" [value]="classroom.id">{{ classroom.name }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Día</mat-label>
        <mat-select [(value)]="dayFilter">
          <mat-option value="all">Todos</mat-option>
          <mat-option *ngFor="let day of days; let index = index" [value]="index">{{ day }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Estado</mat-label>
        <mat-select [(value)]="statusFilter">
          <mat-option value="all">Todos</mat-option>
          <mat-option value="active">Activos</mat-option>
          <mat-option value="inactive">Inactivos</mat-option>
        </mat-select>
      </mat-form-field>
    </app-filter-bar>

    @if (loading) {
      <app-loading-skeleton variant="table" [rows]="5"></app-loading-skeleton>
    } @else if (loadError) {
      <app-error-state [message]="loadError" (retry)="load()"></app-error-state>
    } @else {
      @if (!filteredItems.length) {
        <app-empty-state [title]="emptyTitle" [message]="emptyMessage" [actionLabel]="emptyActionLabel" (action)="emptyAction()"></app-empty-state>
      } @else {
        <app-responsive-table [columns]="columns" [data]="filteredItems" [actionsTemplate]="actionsTpl"></app-responsive-table>
      }
    }

    <ng-template #dayTpl let-row>
      <span class="status-chip day-chip">{{ days[row.day_of_week] }}</span>
    </ng-template>

    <ng-template #activeTpl let-row>
      <span class="status-chip" [class.is-active]="row.active">{{ row.active ? 'Activo' : 'Inactivo' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de horario">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #rowMenu="matMenu">
        <button mat-menu-item (click)="openView(row)">
          <mat-icon>visibility</mat-icon>
          <span>Ver</span>
        </button>
        <button mat-menu-item (click)="openEdit(row)">
          <mat-icon>edit</mat-icon>
          <span>Editar</span>
        </button>
        <button mat-menu-item class="danger-action" (click)="remove(row)">
          <mat-icon>delete</mat-icon>
          <span>Eliminar</span>
        </button>
      </mat-menu>
    </ng-template>
  `,
  styles: `
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--surface-muted);
      color: var(--text-secondary);
      font-size: var(--fs-caption);
      font-weight: 600;
    }
    .status-chip.is-active {
      background: rgba(16, 185, 129, 0.12);
      color: #047857;
    }
    .day-chip {
      background: rgba(79, 70, 229, 0.12);
      color: #3730a3;
    }
    .danger-action {
      color: var(--color-danger);
    }
  `,
})
export class SchedulesComponent implements OnInit {
  @ViewChild('dayTpl', { static: true }) dayTpl!: TemplateRef<unknown>;
  @ViewChild('activeTpl', { static: true }) activeTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Schedule[] = [];
  commissions: Commission[] = [];
  classrooms: Classroom[] = [];
  days = DAYS;
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  commissionFilter = 'all';
  classroomFilter = 'all';
  dayFilter: number | 'all' = 'all';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  primaryAction: PageAction = { label: 'Nuevo horario', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Asistencia' },
    { label: 'Horarios' },
  ];

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'commission_name', header: 'Comisión', accessor: (row) => String((row as Schedule).commission_name), mobilePrimary: true },
      { key: 'subject_name', header: 'Materia', accessor: (row) => String((row as Schedule).subject_name) },
      { key: 'classroom_name', header: 'Aula', accessor: (row) => `${(row as Schedule).classroom_name} (${(row as Schedule).classroom_code})` },
      { key: 'day_of_week', header: 'Día', template: this.dayTpl },
      { key: 'time', header: 'Horario', accessor: (row) => `${(row as Schedule).start_time} - ${(row as Schedule).end_time}` },
      { key: 'active', header: 'Estado', template: this.activeTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [schedules, commissions, classrooms] = await Promise.all([
        this.api.get<Schedule[]>('/schedules'),
        this.api.get<Commission[]>('/commissions'),
        this.api.get<Classroom[]>('/classrooms'),
      ]);
      this.items = schedules;
      this.commissions = commissions;
      this.classrooms = classrooms;
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar los horarios';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Schedule[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => {
      const matchesSearch = !search || [item.commission_name, item.subject_name, item.classroom_name, item.classroom_code, DAYS[item.day_of_week], item.start_time, item.end_time, item.active ? 'activo' : 'inactivo'].some((value) => normalizeText(value).includes(search));
      const matchesCommission = this.commissionFilter === 'all' || item.commission_id === this.commissionFilter;
      const matchesClassroom = this.classroomFilter === 'all' || item.classroom_id === this.classroomFilter;
      const matchesDay = this.dayFilter === 'all' || item.day_of_week === this.dayFilter;
      const matchesStatus = this.statusFilter === 'all' || (this.statusFilter === 'active' ? item.active : !item.active);
      return matchesSearch && matchesCommission && matchesClassroom && matchesDay && matchesStatus;
    });
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0) + Number(this.commissionFilter !== 'all') + Number(this.classroomFilter !== 'all') + Number(this.dayFilter !== 'all') + Number(this.statusFilter !== 'all');
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay horarios';
  }

  get emptyMessage(): string {
    return this.items.length
      ? 'Prueba con otro día, comisión o aula.'
      : 'Crea el primer horario para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar filtros' : 'Nuevo horario';
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.commissionFilter = 'all';
    this.classroomFilter = 'all';
    this.dayFilter = 'all';
    this.statusFilter = 'all';
  }

  emptyAction(): void {
    if (this.activeFilters) {
      this.clearFilters();
      return;
    }
    void this.openCreate();
  }

  async openCreate(): Promise<void> {
    await this.openDialog();
  }

  async openView(schedule: Schedule): Promise<void> {
    await this.openDialog(schedule, true);
  }

  async openEdit(schedule: Schedule): Promise<void> {
    await this.openDialog(schedule);
  }

  private async openDialog(schedule?: Schedule, readonly = false): Promise<void> {
    const fields = readonly ? readonlyFields(scheduleFields(this.commissions, this.classrooms)) : scheduleFields(this.commissions, this.classrooms);
    const ref = this.dialog.open(FormDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      data: {
        title: readonly ? 'Ver horario' : schedule ? 'Editar horario' : 'Nuevo horario',
        subtitle: readonly ? 'Detalles del horario' : 'Define comisión, aula y franja horaria',
        icon: 'schedule',
        fields,
        values: schedule
          ? {
              commission_id: schedule.commission_id,
              classroom_id: schedule.classroom_id,
              day_of_week: schedule.day_of_week,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              active: schedule.active,
            }
          : { commission_id: this.commissions[0]?.id ?? null, classroom_id: this.classrooms[0]?.id ?? null, day_of_week: 1, start_time: '', end_time: '', active: true },
        submitLabel: readonly ? 'Cerrar' : schedule ? 'Guardar cambios' : 'Crear horario',
        ...(readonly
          ? {}
          : {
              submit: async (values: Record<string, unknown>) => {
                const payload = toSchedulePayload(values);
                if (schedule) {
                  await this.api.patch(`/schedules/${schedule.id}`, payload);
                  this.toast.success('Horario actualizado');
                } else {
                  await this.api.post('/schedules', payload);
                  this.toast.success('Horario creado');
                }
              },
            }),
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result && !readonly) {
      await this.load();
    }
  }

  async remove(schedule: Schedule): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar horario',
        message: `¿Eliminar el horario de ${DAYS[schedule.day_of_week]} de ${schedule.start_time} a ${schedule.end_time}? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/schedules/${schedule.id}`);
      this.toast.success('Horario eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
