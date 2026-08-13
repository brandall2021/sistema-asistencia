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
import { Commission, Enrollment, Student } from '../../../core/models';
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

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function initialFor(name: string): string {
  return (name.trim().charAt(0) || 'E').toUpperCase();
}

function enrollmentFields(students: Student[], commissions: Commission[]): FieldConfig[] {
  return [
    {
      key: 'student_id',
      label: 'Alumno',
      type: 'select',
      required: true,
      options: students.map((student) => ({ label: `${student.full_name} (${student.registration_number})`, value: student.id })),
      width: 'full',
    },
    {
      key: 'commission_id',
      label: 'Comisión',
      type: 'select',
      required: true,
      options: commissions.map((commission) => ({ label: `${commission.name} - ${commission.subject_name}`, value: commission.id })),
      width: 'full',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      options: [
        { label: 'Activa', value: 'ACTIVE' },
        { label: 'Inactiva', value: 'INACTIVE' },
      ],
      width: 'half',
    },
  ];
}

function toEnrollmentPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    student_id: String(values['student_id'] ?? ''),
    commission_id: String(values['commission_id'] ?? ''),
    status: String(values['status'] ?? 'ACTIVE'),
  };
}

@Component({
  selector: 'app-enrollments',
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
      title="Inscripciones"
      subtitle="Estudiantes inscritos en comisiones"
      icon="how_to_reg"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por alumno, legajo, comisión o materia"
      [searchValue]="searchTerm"
      (searchValueChange)="searchTerm = $event"
      [resultCount]="filteredItems.length"
      [activeFilters]="activeFilters"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
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
        <mat-label>Estado</mat-label>
        <mat-select [(value)]="statusFilter">
          <mat-option value="all">Todos</mat-option>
          <mat-option value="ACTIVE">Activas</mat-option>
          <mat-option value="INACTIVE">Inactivas</mat-option>
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

    <ng-template #studentTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ initialForEnrollment(row.student_full_name) }}</div>
        <div>
          <div class="entity-title">{{ row.student_full_name }}</div>
          <div class="entity-subtitle">{{ row.registration_number }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #statusTpl let-row>
      <span class="status-chip" [class.is-active]="row.status === 'ACTIVE'">{{ row.status === 'ACTIVE' ? 'Activa' : 'Inactiva' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de inscripción">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #rowMenu="matMenu">
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
    .entity-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .entity-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 999px;
      background: var(--color-primary-50);
      color: var(--color-primary-700);
      font-weight: 700;
      flex: none;
    }
    .entity-title {
      font-weight: 600;
      color: var(--text-primary);
    }
    .entity-subtitle {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
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
    .danger-action {
      color: var(--color-danger);
    }
  `,
})
export class EnrollmentsComponent implements OnInit {
  @ViewChild('studentTpl', { static: true }) studentTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Enrollment[] = [];
  students: Student[] = [];
  commissions: Commission[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  commissionFilter = 'all';
  statusFilter = 'all';
  primaryAction: PageAction = { label: 'Nueva inscripción', icon: 'add', type: 'flat', color: 'primary' };

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'student_full_name', header: 'Alumno', template: this.studentTpl, mobilePrimary: true },
      { key: 'registration_number', header: 'Legajo', accessor: (row) => String((row as Enrollment).registration_number) },
      { key: 'commission_name', header: 'Comisión', accessor: (row) => String((row as Enrollment).commission_name) },
      { key: 'subject_name', header: 'Materia', accessor: (row) => String((row as Enrollment).subject_name) },
      { key: 'status', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [enrollments, students, commissions] = await Promise.all([
        this.api.get<Enrollment[]>('/enrollments'),
        this.api.get<Student[]>('/students'),
        this.api.get<Commission[]>('/commissions'),
      ]);
      this.items = enrollments;
      this.students = students;
      this.commissions = commissions;
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar las inscripciones';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Enrollment[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => {
      const matchesSearch = !search || [item.student_full_name, item.registration_number, item.commission_name, item.subject_name, item.status === 'ACTIVE' ? 'activa' : 'inactiva'].some((value) => normalizeText(value).includes(search));
      const matchesCommission = this.commissionFilter === 'all' || item.commission_id === this.commissionFilter;
      const matchesStatus = this.statusFilter === 'all' || item.status === this.statusFilter;
      return matchesSearch && matchesCommission && matchesStatus;
    });
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0) + Number(this.commissionFilter !== 'all') + Number(this.statusFilter !== 'all');
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay inscripciones';
  }

  get emptyMessage(): string {
    return this.items.length
      ? 'Prueba con otra comisión o limpia los filtros.'
      : 'Crea la primera inscripción para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar filtros' : 'Nueva inscripción';
  }

  initialForEnrollment(name: string): string {
    return initialFor(name);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.commissionFilter = 'all';
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

  async openEdit(enrollment: Enrollment): Promise<void> {
    await this.openDialog(enrollment);
  }

  private async openDialog(enrollment?: Enrollment): Promise<void> {
    const ref = this.dialog.open(FormDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        title: enrollment ? 'Editar inscripción' : 'Nueva inscripción',
        subtitle: 'Selecciona alumno, comisión y estado',
        icon: 'how_to_reg',
        fields: enrollmentFields(this.students, this.commissions),
        values: enrollment
          ? { student_id: enrollment.student_id, commission_id: enrollment.commission_id, status: enrollment.status }
          : { student_id: this.students[0]?.id ?? null, commission_id: this.commissions[0]?.id ?? null, status: 'ACTIVE' },
        submitLabel: enrollment ? 'Guardar cambios' : 'Crear inscripción',
        submit: async (values: Record<string, unknown>) => {
          const payload = toEnrollmentPayload(values);
          if (enrollment) {
            await this.api.patch(`/enrollments/${enrollment.id}`, payload);
            this.toast.success('Inscripción actualizada');
          } else {
            await this.api.post('/enrollments', payload);
            this.toast.success('Inscripción creada');
          }
        },
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(enrollment: Enrollment): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar inscripción',
        message: `¿Eliminar la inscripción de "${enrollment.student_full_name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/enrollments/${enrollment.id}`);
      this.toast.success('Inscripción eliminada');
      await this.load();
    } catch (error: any) {
      this.toast.error(error?.error?.detail || 'Error al eliminar');
    }
  }
}
