import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/services/api.service';
import { Teacher } from '../../../core/models';
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

function teacherFields(editing = false): FieldConfig[] {
  const fields: FieldConfig[] = [
    { key: 'full_name', label: 'Nombre completo', type: 'text', required: true, section: 'Datos personales', width: 'half' },
    { key: 'email', label: 'Email', type: 'email', required: true, section: 'Datos personales', width: 'half' },
    { key: 'username', label: 'Usuario', type: 'text', required: true, disabled: editing, section: 'Datos personales', width: 'half' },
    { key: 'employee_number', label: 'Legajo', type: 'text', required: true, section: 'Datos laborales', width: 'half' },
    { key: 'title', label: 'Título', type: 'text', section: 'Datos laborales', width: 'half' },
    { key: 'department', label: 'Departamento', type: 'text', section: 'Datos laborales', width: 'half' },
  ];
  if (!editing) {
    fields.splice(3, 0, { key: 'password', label: 'Contraseña', type: 'password', required: true, section: 'Datos personales', width: 'half' });
  }
  return fields;
}

function toTeacherPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    username: String(values['username'] ?? '').trim(),
    password: String(values['password'] ?? ''),
    employee_number: String(values['employee_number'] ?? '').trim(),
    title: String(values['title'] ?? '').trim() || null,
    department: String(values['department'] ?? '').trim() || null,
  };
}

function toTeacherUpdatePayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    employee_number: String(values['employee_number'] ?? '').trim(),
    title: String(values['title'] ?? '').trim() || null,
    department: String(values['department'] ?? '').trim() || null,
  };
}

@Component({
  selector: 'app-teachers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, MatButtonModule, MatDialogModule, MatIconModule,
    MatMenuModule, PageHeaderComponent, FilterBarComponent, ResponsiveTableComponent,
    LoadingSkeletonComponent, EmptyStateComponent, ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Docentes"
      subtitle="Gestión de docentes del plantel"
      icon="badge"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, legajo, email o departamento"
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

    <ng-template #teacherTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ initialForTeacher(row.full_name) }}</div>
        <div>
          <div class="entity-title">{{ row.full_name }}</div>
          <div class="entity-subtitle">{{ row.employee_number }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #statusTpl let-row>
      <span class="status-chip" [class.is-active]="row.is_active">{{ row.is_active ? 'Activo' : 'Inactivo' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de docente">
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
export class TeachersComponent implements OnInit {
  @ViewChild('teacherTpl', { static: true }) teacherTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Teacher[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  primaryAction: PageAction = { label: 'Nuevo docente', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Académico' },
    { label: 'Docentes' },
  ];

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'full_name', header: 'Docente', template: this.teacherTpl, mobilePrimary: true },
      { key: 'email', header: 'Email', accessor: (row) => String((row as Teacher).email) },
      { key: 'title', header: 'Título', accessor: (row) => String((row as Teacher).title ?? '') },
      { key: 'department', header: 'Departamento', accessor: (row) => String((row as Teacher).department ?? '') },
      { key: 'is_active', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.items = await this.api.get<Teacher[]>('/teachers');
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar los docentes';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Teacher[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => !search || [item.full_name, item.employee_number, item.email, item.title, item.department, item.username, item.is_active ? 'activo' : 'inactivo'].some((value) => normalizeText(value).includes(search)));
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0);
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay docentes';
  }

  get emptyMessage(): string {
    return this.items.length ? 'Prueba con otro texto o limpia la búsqueda.' : 'Crea el primer docente para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar búsqueda' : 'Nuevo docente';
  }

  initialForTeacher(name: string): string {
    return (name.trim().charAt(0) || 'D').toUpperCase();
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

  async openEdit(teacher: Teacher): Promise<void> {
    await this.openDrawer(teacher);
  }

  private async openDrawer(teacher?: Teacher): Promise<void> {
    const editing = !!teacher;
    const ref = FormDrawerComponent.open(this.dialog, {
      title: editing ? 'Editar docente' : 'Nuevo docente',
      subtitle: editing ? 'Actualiza los datos del docente' : 'Completa los datos personales y laborales',
      icon: 'badge',
      fields: teacherFields(editing),
      values: teacher
        ? {
            full_name: teacher.full_name,
            email: teacher.email,
            username: teacher.username,
            employee_number: teacher.employee_number,
            title: teacher.title,
            department: teacher.department,
          }
        : { full_name: '', email: '', username: '', password: '', employee_number: '', title: '', department: '' },
      submitLabel: editing ? 'Guardar cambios' : 'Crear docente',
      submit: async (values: Record<string, unknown>) => {
        if (teacher) {
          await this.api.patch(`/teachers/${teacher.id}`, toTeacherUpdatePayload(values));
          this.toast.success('Docente actualizado');
          return;
        }
        await this.api.post('/teachers', toTeacherPayload(values));
        this.toast.success('Docente creado');
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(teacher: Teacher): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar docente',
        message: `¿Eliminar al docente "${teacher.full_name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/teachers/${teacher.id}`);
      this.toast.success('Docente eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
