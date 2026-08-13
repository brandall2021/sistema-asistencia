import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { RoleName, User } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageAction, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';
import { FormDrawerComponent } from '../../../shared/forms/form-drawer.component';
import { FieldConfig } from '../../../shared/forms/form-fields';
import { ROLE_LABELS } from '../../../shared/status';
import { Toast } from '../../../shared/toast';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function userFields(editing = false): FieldConfig[] {
  const fields: FieldConfig[] = [
    { key: 'full_name', label: 'Nombre completo', type: 'text', required: true, section: 'Datos personales', width: 'half' },
    { key: 'email', label: 'Email', type: 'email', required: true, section: 'Datos personales', width: 'half' },
    { key: 'username', label: 'Usuario', type: 'text', required: true, section: 'Datos personales', width: 'half' },
    { key: 'roles', label: 'Roles', type: 'multiselect', required: true, options: (Object.values(RoleName) as RoleName[]).map((role) => ({ label: ROLE_LABELS[role], value: role })), section: 'Permisos', width: 'full' },
    { key: 'is_active', label: 'Usuario activo', type: 'checkbox', section: 'Permisos', width: 'full' },
  ];
  if (!editing) {
    fields.splice(3, 0, { key: 'password', label: 'Contraseña', type: 'password', required: true, section: 'Datos personales', width: 'half' });
  }
  return fields;
}

function toUserPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    username: String(values['username'] ?? '').trim(),
    password: String(values['password'] ?? ''),
    roles: Array.isArray(values['roles']) ? values['roles'] : [],
    is_active: !!values['is_active'],
  };
}

function toUserUpdatePayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    full_name: String(values['full_name'] ?? '').trim(),
    email: String(values['email'] ?? '').trim(),
    username: String(values['username'] ?? '').trim(),
    roles: Array.isArray(values['roles']) ? values['roles'] : [],
    is_active: !!values['is_active'],
  };
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    PageHeaderComponent,
    FilterBarComponent,
    ResponsiveTableComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Usuarios"
      subtitle="Gestión de cuentas y roles del sistema"
      icon="manage_accounts"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, email, usuario o rol"
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

    <ng-template #userTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ initialForUser(row.full_name) }}</div>
        <div>
          <div class="entity-title">{{ row.full_name }}</div>
          <div class="entity-subtitle">{{ row.username }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #rolesTpl let-row>
      <span class="chip" *ngFor="let r of row.roles">{{ roleLabel(r) }}</span>
    </ng-template>

    <ng-template #statusTpl let-row>
      <span class="status-chip" [class.is-active]="row.is_active">{{ row.is_active ? 'Activo' : 'Inactivo' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de usuario">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #rowMenu="matMenu">
        <button mat-menu-item (click)="openEdit(row)">
          <mat-icon>edit</mat-icon>
          <span>Editar</span>
        </button>
        <span [matTooltip]="isCurrentUser(row) ? 'No podés eliminar tu propia cuenta' : ''" matTooltipPosition="above">
          <button mat-menu-item class="danger-action" [disabled]="isCurrentUser(row)" (click)="remove(row)">
            <mat-icon>delete</mat-icon>
            <span>Eliminar</span>
          </button>
        </span>
      </mat-menu>
    </ng-template>
  `,
  styles: `
    .entity-cell { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .entity-avatar { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-700); font-weight: 700; flex: none; }
    .entity-title { font-weight: 600; color: var(--text-primary); }
    .entity-subtitle { font-size: var(--fs-caption); color: var(--text-secondary); }
    .chip { background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; margin-right: 4px; }
    .status-chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: var(--surface-muted); color: var(--text-secondary); font-size: var(--fs-caption); font-weight: 600; }
    .status-chip.is-active { background: rgba(16, 185, 129, 0.12); color: #047857; }
    .danger-action { color: var(--color-danger); }
  `,
})
export class UsersComponent implements OnInit {
  @ViewChild('userTpl', { static: true }) userTpl!: TemplateRef<unknown>;
  @ViewChild('rolesTpl', { static: true }) rolesTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: User[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  primaryAction: PageAction = { label: 'Nuevo usuario', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Administración' },
    { label: 'Usuarios' },
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
      { key: 'full_name', header: 'Usuario', template: this.userTpl, mobilePrimary: true },
      { key: 'email', header: 'Email', accessor: (row) => String((row as User).email) },
      { key: 'username', header: 'Usuario', accessor: (row) => String((row as User).username) },
      { key: 'roles', header: 'Roles', template: this.rolesTpl },
      { key: 'is_active', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.items = await this.api.get<User[]>('/users');
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar los usuarios';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): User[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => !search || [item.full_name, item.email, item.username, item.roles.join(' '), item.is_active ? 'activo' : 'inactivo'].some((value) => normalizeText(value).includes(search)));
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0);
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay usuarios';
  }

  get emptyMessage(): string {
    return this.items.length ? 'Prueba con otro texto o limpia la búsqueda.' : 'Crea el primer usuario para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar búsqueda' : 'Nuevo usuario';
  }

  initialForUser(name: string): string {
    return (name.trim().charAt(0) || 'U').toUpperCase();
  }

  roleLabel(role: RoleName): string {
    return ROLE_LABELS[role] ?? role;
  }

  isCurrentUser(user: User): boolean {
    return !!this.auth.getUser()?.id && this.auth.getUser().id === user.id;
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

  async openEdit(user: User): Promise<void> {
    await this.openDrawer(user);
  }

  private async openDrawer(user?: User): Promise<void> {
    const editing = !!user;
    const ref = FormDrawerComponent.open(this.dialog, {
      title: editing ? 'Editar usuario' : 'Nuevo usuario',
      subtitle: editing ? 'Actualiza los datos y permisos de la cuenta' : 'Completa los datos de la nueva cuenta',
      icon: 'manage_accounts',
      fields: userFields(editing),
      values: user
        ? { full_name: user.full_name, email: user.email, username: user.username, roles: [...user.roles], is_active: user.is_active }
        : { full_name: '', email: '', username: '', password: '', roles: [RoleName.ALUMNO], is_active: true },
      submitLabel: editing ? 'Guardar cambios' : 'Crear usuario',
      submit: async (values: Record<string, unknown>) => {
        if (user) {
          await this.api.patch(`/users/${user.id}`, toUserUpdatePayload(values));
          this.toast.success('Usuario actualizado');
          return;
        }
        await this.api.post('/users', toUserPayload(values));
        this.toast.success('Usuario creado');
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(user: User): Promise<void> {
    if (this.isCurrentUser(user)) {
      return;
    }
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar usuario',
        message: `¿Eliminar al usuario "${user.full_name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/users/${user.id}`);
      this.toast.success('Usuario eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
