import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Career, Student } from '../../../core/models';
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

function studentFields(careers: Career[], editing = false): FieldConfig[] {
  return [
    { key: 'full_name', label: 'Nombre completo', type: 'text', required: true, section: 'Datos personales', width: 'half' },
    { key: 'dni', label: 'DNI', type: 'text', section: 'Datos personales', width: 'half' },
    { key: 'email', label: 'Email', type: 'email', required: true, section: 'Datos personales', width: 'half' },
    { key: 'password', label: 'Contraseña', type: 'password', required: !editing, section: 'Datos personales', width: 'half' },
    { key: 'registration_number', label: 'Legajo', type: 'text', required: true, section: 'Datos académicos', width: 'half' },
    {
      key: 'career_id',
      label: 'Carrera',
      type: 'select',
      required: true,
      options: careers.map((career) => ({ label: `${career.name} (${career.code})`, value: career.id })),
      section: 'Datos académicos',
      width: 'half',
    },
    { key: 'year', label: 'Año', type: 'number', section: 'Datos académicos', width: 'half' },
  ];
}

function toStudentCreatePayload(values: Record<string, unknown>): Record<string, unknown> {
  const email = String(values['email'] ?? '').trim();
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    dni: String(values['dni'] ?? '').trim() || null,
    email,
    username: email.split('@')[0] || email,
    password: String(values['password'] ?? ''),
    registration_number: String(values['registration_number'] ?? '').trim(),
    career_id: String(values['career_id'] ?? ''),
    year: values['year'] === '' || values['year'] == null ? null : Number(values['year']),
  };
}

function toStudentUpdatePayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    registration_number: String(values['registration_number'] ?? '').trim(),
    dni: String(values['dni'] ?? '').trim() || null,
    career_id: String(values['career_id'] ?? ''),
    year: values['year'] === '' || values['year'] == null ? null : Number(values['year']),
  };
}

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatMenuModule,
    PageHeaderComponent, FilterBarComponent, ResponsiveTableComponent, LoadingSkeletonComponent,
    EmptyStateComponent, ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Estudiantes"
      subtitle="Gestión de estudiantes y su carrera"
      icon="school"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, legajo, email o carrera"
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

    <ng-template #studentTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ initialForStudent(row.full_name) }}</div>
        <div>
          <div class="entity-title">{{ row.full_name }}</div>
          <div class="entity-subtitle">{{ row.registration_number }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #statusTpl let-row>
      <span class="status-chip" [class.is-active]="row.is_active">{{ row.is_active ? 'Activo' : 'Inactivo' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de estudiante">
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
export class StudentsComponent implements OnInit {
  @ViewChild('studentTpl', { static: true }) studentTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Student[] = [];
  careers: Career[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  primaryAction: PageAction = { label: 'Nuevo estudiante', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Académico' },
    { label: 'Estudiantes' },
  ];

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'full_name', header: 'Estudiante', template: this.studentTpl, mobilePrimary: true },
      { key: 'career_name', header: 'Carrera', accessor: (row) => String((row as Student).career_name ?? '') },
      { key: 'email', header: 'Email', accessor: (row) => String((row as Student).email) },
      { key: 'year', header: 'Año', accessor: (row) => String((row as Student).year ?? '') },
      { key: 'is_active', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [students, careers] = await Promise.all([this.api.get<Student[]>('/students'), this.api.get<Career[]>('/careers')]);
      this.items = students;
      this.careers = careers;
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar los estudiantes';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Student[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => !search || [item.full_name, item.registration_number, item.dni, item.career_name, item.email, item.year, item.username, item.is_active ? 'activo' : 'inactivo'].some((value) => normalizeText(value).includes(search)));
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0);
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay estudiantes';
  }

  get emptyMessage(): string {
    return this.items.length ? 'Prueba con otro texto o limpia la búsqueda.' : 'Crea el primer estudiante para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar búsqueda' : 'Nuevo estudiante';
  }

  initialForStudent(name: string): string {
    return (name.trim().charAt(0) || 'E').toUpperCase();
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

  async openEdit(student: Student): Promise<void> {
    await this.openDrawer(student);
  }

  private async openDrawer(student?: Student): Promise<void> {
    const editing = !!student;
    const ref = FormDrawerComponent.open(this.dialog, {
      title: editing ? 'Editar estudiante' : 'Nuevo estudiante',
      subtitle: editing ? 'Actualiza los datos del estudiante' : 'Completa los datos personales y académicos',
      icon: 'school',
      fields: studentFields(this.careers, editing),
      values: student
        ? {
            full_name: student.full_name,
            dni: student.dni,
            email: student.email,
            password: '',
            registration_number: student.registration_number,
            career_id: student.career_id,
            year: student.year,
          }
        : { full_name: '', dni: '', email: '', password: '', registration_number: '', career_id: this.careers[0]?.id ?? null, year: null },
      submitLabel: editing ? 'Guardar cambios' : 'Crear estudiante',
      submit: async (values: Record<string, unknown>) => {
        if (student) {
          await this.api.patch(`/students/${student.id}`, toStudentUpdatePayload(values));
          const password = String(values['password'] ?? '').trim();
          if (password) {
            await this.api.patch(`/users/${student.user_id}`, { password });
          }
          this.toast.success('Estudiante actualizado');
          return;
        }
        await this.api.post('/students', toStudentCreatePayload(values));
        this.toast.success('Estudiante creado');
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(student: Student): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar estudiante',
        message: `¿Eliminar al estudiante "${student.full_name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/students/${student.id}`);
      this.toast.success('Estudiante eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
