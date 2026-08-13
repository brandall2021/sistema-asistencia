import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/services/api.service';
import { Career, Commission, Subject, Teacher } from '../../../core/models';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageAction, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';
import { FormDrawerComponent } from '../../../shared/forms/form-drawer.component';
import { FieldConfig } from '../../../shared/forms/form-fields';
import { Toast } from '../../../shared/toast';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function commissionFields(careers: Career[], subjects: Subject[], teachers: Teacher[]): FieldConfig[] {
  return [
    { key: 'name', label: 'Nombre', type: 'text', required: true, section: 'Datos generales', width: 'half' },
    { key: 'code', label: 'Código', type: 'text', required: true, section: 'Datos generales', width: 'half' },
    {
      key: 'subject_id',
      label: 'Materia',
      type: 'select',
      required: true,
      options: subjects.map((subject) => ({ label: `${subject.name} (${subject.code})`, value: subject.id })),
      section: 'Asignación',
      width: 'half',
    },
    {
      key: 'career_id',
      label: 'Carrera',
      type: 'select',
      required: true,
      options: careers.map((career) => ({ label: `${career.name} (${career.code})`, value: career.id })),
      section: 'Asignación',
      width: 'half',
    },
    {
      key: 'teacher_id',
      label: 'Docente',
      type: 'select',
      options: teachers.map((teacher) => ({ label: teacher.full_name, value: teacher.id })),
      section: 'Asignación',
      width: 'full',
    },
    { key: 'year', label: 'Año', type: 'number', required: true, section: 'Configuración', width: 'half' },
    { key: 'period', label: 'Período', type: 'select', required: true, options: [{ label: '1', value: '1' }, { label: '2', value: '2' }], section: 'Configuración', width: 'half' },
    { key: 'capacity', label: 'Capacidad', type: 'number', section: 'Configuración', width: 'half' },
    { key: 'active', label: 'Activa', type: 'checkbox', section: 'Configuración', width: 'full' },
  ];
}

function toCommissionPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    name: String(values['name'] ?? '').trim(),
    code: String(values['code'] ?? '').trim(),
    subject_id: String(values['subject_id'] ?? ''),
    career_id: String(values['career_id'] ?? ''),
    teacher_id: String(values['teacher_id'] ?? '') || null,
    year: values['year'] === '' || values['year'] == null ? null : Number(values['year']),
    period: String(values['period'] ?? ''),
    capacity: values['capacity'] === '' || values['capacity'] == null ? null : Number(values['capacity']),
    active: !!values['active'],
  };
}

@Component({
  selector: 'app-commissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatDialogModule, MatIconModule,
    MatMenuModule, PageHeaderComponent, FilterBarComponent, ResponsiveTableComponent,
    LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Comisiones"
      subtitle="Agrupaciones de estudiantes por materia, año y cuatrimestre"
      icon="groups"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, código, materia o docente"
      [searchValue]="searchTerm"
      (searchValueChange)="searchTerm = $event"
      [resultCount]="filteredItems.length"
      [activeFilters]="activeFilters"
      (clearFilters)="clearFilters()"
      (search)="searchTerm = $event"
    ></app-filter-bar>

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

    <ng-template #commissionTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ initialForCommission(row.name) }}</div>
        <div>
          <div class="entity-title">{{ row.name }}</div>
          <div class="entity-subtitle">{{ row.code }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #statusTpl let-row>
      <span class="status-chip" [class.is-active]="row.active">{{ row.active ? 'Activa' : 'Inactiva' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de comisión">
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
    .entity-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .entity-avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-700); font-weight: 700; flex: none; }
    .entity-title { font-weight: 600; color: var(--text-primary); }
    .entity-subtitle { font-size: var(--fs-caption); color: var(--text-secondary); }
    .status-chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: var(--surface-muted); color: var(--text-secondary); font-size: var(--fs-caption); font-weight: 600; }
    .status-chip.is-active { background: rgba(16, 185, 129, 0.12); color: #047857; }
    .danger-action { color: var(--color-danger); }
  `,
})
export class CommissionsComponent implements OnInit {
  @ViewChild('commissionTpl', { static: true }) commissionTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Commission[] = [];
  careers: Career[] = [];
  subjects: Subject[] = [];
  teachers: Teacher[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  primaryAction: PageAction = { label: 'Nueva comisión', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Académico' },
    { label: 'Comisiones' },
  ];

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'name', header: 'Comisión', template: this.commissionTpl, mobilePrimary: true },
      { key: 'subject_name', header: 'Materia', accessor: (row) => String((row as Commission).subject_name ?? '') },
      { key: 'career_name', header: 'Carrera', accessor: (row) => String((row as Commission).career_name ?? '') },
      { key: 'teacher_name', header: 'Docente', accessor: (row) => String((row as Commission).teacher_name ?? '') },
      { key: 'year_period', header: 'Año / Período', accessor: (row) => `${(row as Commission).year} - ${(row as Commission).period}` },
      { key: 'capacity', header: 'Capacidad', accessor: (row) => String((row as Commission).capacity ?? '') },
      { key: 'active', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [commissions, careers, subjects, teachers] = await Promise.all([
        this.api.get<Commission[]>('/commissions'),
        this.api.get<Career[]>('/careers'),
        this.api.get<Subject[]>('/subjects'),
        this.api.get<Teacher[]>('/teachers'),
      ]);
      this.items = commissions;
      this.careers = careers;
      this.subjects = subjects;
      this.teachers = teachers;
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar las comisiones';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Commission[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => !search || [item.name, item.code, item.subject_name, item.career_name, item.teacher_name, item.year, item.period, item.capacity, item.active ? 'activa' : 'inactiva'].some((value) => normalizeText(value).includes(search)));
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0);
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay comisiones';
  }

  get emptyMessage(): string {
    return this.items.length ? 'Prueba con otro texto o limpia la búsqueda.' : 'Crea la primera comisión para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar búsqueda' : 'Nueva comisión';
  }

  initialForCommission(name: string): string {
    return (name.trim().charAt(0) || 'C').toUpperCase();
  }

  clearFilters(): void {
    this.searchTerm = '';
  }

  emptyAction(): void {
    if (this.activeFilters) {
      this.clearFilters();
      return;
    }
    void this.openCreate();
  }

  async openCreate(): Promise<void> {
    await this.openDrawer();
  }

  async openEdit(commission: Commission): Promise<void> {
    await this.openDrawer(commission);
  }

  private async openDrawer(commission?: Commission): Promise<void> {
    const editing = !!commission;
    const ref = FormDrawerComponent.open(this.dialog, {
      title: editing ? 'Editar comisión' : 'Nueva comisión',
      subtitle: editing ? 'Actualiza la configuración de la comisión' : 'Completa los datos de la nueva comisión',
      icon: 'groups',
      fields: commissionFields(this.careers, this.subjects, this.teachers),
      values: commission
        ? {
            name: commission.name,
            code: commission.code,
            subject_id: commission.subject_id,
            career_id: commission.career_id,
            teacher_id: commission.teacher_id,
            year: commission.year,
            period: commission.period,
            capacity: commission.capacity,
            active: commission.active,
          }
        : { name: '', code: '', subject_id: this.subjects[0]?.id ?? null, career_id: this.careers[0]?.id ?? null, teacher_id: this.teachers[0]?.id ?? null, year: new Date().getFullYear(), period: '1', capacity: null, active: true },
      submitLabel: editing ? 'Guardar cambios' : 'Crear comisión',
      submit: async (values: Record<string, unknown>) => {
        const payload = toCommissionPayload(values);
        if (commission) {
          await this.api.patch(`/commissions/${commission.id}`, payload);
          this.toast.success('Comisión actualizada');
          return;
        }
        await this.api.post('/commissions', payload);
        this.toast.success('Comisión creada');
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(commission: Commission): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar comisión',
        message: `¿Eliminar la comisión "${commission.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/commissions/${commission.id}`);
      this.toast.success('Comisión eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
