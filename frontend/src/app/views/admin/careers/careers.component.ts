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
import { Career } from '../../../core/models';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { FormDialogComponent } from '../../../shared/forms/form-dialog.component';
import { FieldConfig } from '../../../shared/forms/form-fields';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageAction, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';
import { Toast } from '../../../shared/toast';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function initialFor(name: string): string {
  return (name.trim().charAt(0) || 'C').toUpperCase();
}

function careerFields(): FieldConfig[] {
  return [
    { key: 'name', label: 'Nombre', type: 'text', required: true, width: 'half' },
    { key: 'code', label: 'Código', type: 'text', required: true, width: 'half' },
    { key: 'description', label: 'Descripción', type: 'textarea', width: 'full' },
    { key: 'active', label: 'Activa', type: 'checkbox', width: 'full' },
  ];
}

function readonlyFields(fields: FieldConfig[]): FieldConfig[] {
  return fields.map((field) => ({ ...field, disabled: true }));
}

function toCareerPayload(values: Record<string, unknown>): Record<string, unknown> {
  const description = String(values['description'] ?? '').trim();
  return {
    name: String(values['name'] ?? '').trim(),
    code: String(values['code'] ?? '').trim(),
    description: description || undefined,
    active: !!values['active'],
  };
}

@Component({
  selector: 'app-careers',
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
      title="Carreras"
      subtitle="Gestión breve de carreras de la institución"
      icon="school"
      [breadcrumbs]="breadcrumbs"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, código o descripción"
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
        <mat-label>Estado</mat-label>
        <mat-select [(value)]="statusFilter">
          <mat-option value="all">Todos</mat-option>
          <mat-option value="active">Activas</mat-option>
          <mat-option value="inactive">Inactivas</mat-option>
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

    <ng-template #nameTpl let-row>
      <div class="entity-cell">
        <div class="entity-avatar">{{ careerInitial(row) }}</div>
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
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de carrera">
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
export class CareersComponent implements OnInit {
  @ViewChild('nameTpl', { static: true }) nameTpl!: TemplateRef<unknown>;
  @ViewChild('statusTpl', { static: true }) statusTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Career[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  primaryAction: PageAction = { label: 'Nueva carrera', icon: 'add', type: 'flat', color: 'primary' };
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Académico' },
    { label: 'Carreras' },
  ];

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'name', header: 'Carrera', template: this.nameTpl, mobilePrimary: true },
      { key: 'code', header: 'Código', accessor: (row) => String((row as Career).code) },
      { key: 'description', header: 'Descripción', accessor: (row) => (row as Career).description ?? 'Sin descripción' },
      { key: 'active', header: 'Estado', template: this.statusTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.items = await this.api.get<Career[]>('/careers');
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar las carreras';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Career[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => {
      const matchesSearch = !search || [item.name, item.code, item.description, item.active ? 'activa' : 'inactiva'].some((value) => normalizeText(value).includes(search));
      const matchesStatus = this.statusFilter === 'all' || (this.statusFilter === 'active' ? item.active : !item.active);
      return matchesSearch && matchesStatus;
    });
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0) + Number(this.statusFilter !== 'all');
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay carreras';
  }

  get emptyMessage(): string {
    return this.items.length
      ? 'Prueba con otros filtros o limpia la búsqueda.'
      : 'Crea la primera carrera para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar filtros' : 'Nueva carrera';
  }

  careerInitial(row: Career): string {
    return initialFor(row.name);
  }

  clearFilters(): void {
    this.searchTerm = '';
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

  async openView(career: Career): Promise<void> {
    await this.openDialog(career, true);
  }

  async openEdit(career: Career): Promise<void> {
    await this.openDialog(career);
  }

  private async openDialog(career?: Career, readonly = false): Promise<void> {
    const fields = readonly ? readonlyFields(careerFields()) : careerFields();
    const ref = this.dialog.open(FormDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        title: readonly ? 'Ver carrera' : career ? 'Editar carrera' : 'Nueva carrera',
        subtitle: readonly ? 'Detalles de la carrera' : 'Completa los datos breves de la carrera',
        icon: 'school',
        fields,
        values: career
          ? { name: career.name, code: career.code, description: career.description ?? '', active: career.active }
          : { name: '', code: '', description: '', active: true },
        submitLabel: readonly ? 'Cerrar' : career ? 'Guardar cambios' : 'Crear carrera',
        ...(readonly
          ? {}
          : {
              submit: async (values: Record<string, unknown>) => {
                const payload = toCareerPayload(values);
                if (career) {
                  await this.api.patch(`/careers/${career.id}`, payload);
                  this.toast.success('Carrera actualizada');
                } else {
                  await this.api.post('/careers', payload);
                  this.toast.success('Carrera creada');
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

  async remove(career: Career): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar carrera',
        message: `¿Eliminar la carrera "${career.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/careers/${career.id}`);
      this.toast.success('Carrera eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
