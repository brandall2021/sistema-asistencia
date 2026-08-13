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
import { Career, Subject } from '../../../core/models';
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
  return (name.trim().charAt(0) || 'M').toUpperCase();
}

function subjectFields(careers: Career[]): FieldConfig[] {
  return [
    { key: 'name', label: 'Nombre', type: 'text', required: true, width: 'half' },
    { key: 'code', label: 'Código', type: 'text', required: true, width: 'half' },
    {
      key: 'career_id',
      label: 'Carrera',
      type: 'select',
      required: true,
      options: careers.map((career) => ({ label: `${career.name} (${career.code})`, value: career.id })),
      width: 'full',
    },
    { key: 'semester', label: 'Semestre', type: 'number', width: 'half' },
    { key: 'credits', label: 'Créditos', type: 'number', width: 'half' },
    { key: 'active', label: 'Activa', type: 'checkbox', width: 'full' },
  ];
}

function toSubjectPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    name: String(values['name'] ?? '').trim(),
    code: String(values['code'] ?? '').trim(),
    career_id: String(values['career_id'] ?? ''),
    semester: values['semester'] === '' || values['semester'] == null ? null : Number(values['semester']),
    credits: values['credits'] === '' || values['credits'] == null ? null : Number(values['credits']),
    active: !!values['active'],
  };
}

@Component({
  selector: 'app-subjects',
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
      title="Materias"
      subtitle="Gestión breve de materias y planes de estudio"
      icon="menu_book"
      [primaryAction]="primaryAction"
      (primaryClick)="openCreate()"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por nombre, código o carrera"
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
        <mat-label>Carrera</mat-label>
        <mat-select [(value)]="careerFilter">
          <mat-option value="all">Todas</mat-option>
          <mat-option *ngFor="let career of careers" [value]="career.id">{{ career.name }}</mat-option>
        </mat-select>
      </mat-form-field>
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
        <div class="entity-avatar">{{ initialForSubject(row.name) }}</div>
        <div>
          <div class="entity-title">{{ row.name }}</div>
          <div class="entity-subtitle">{{ row.code }}</div>
        </div>
      </div>
    </ng-template>

    <ng-template #activeTpl let-row>
      <span class="status-chip" [class.is-active]="row.active">{{ row.active ? 'Activa' : 'Inactiva' }}</span>
    </ng-template>

    <ng-template #actionsTpl let-row>
      <button mat-icon-button [matMenuTriggerFor]="rowMenu" aria-label="Acciones de materia">
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
export class SubjectsComponent implements OnInit {
  @ViewChild('nameTpl', { static: true }) nameTpl!: TemplateRef<unknown>;
  @ViewChild('activeTpl', { static: true }) activeTpl!: TemplateRef<unknown>;
  @ViewChild('actionsTpl', { static: true }) actionsTpl!: TemplateRef<unknown>;

  items: Subject[] = [];
  careers: Career[] = [];
  columns: TableColumn[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';
  careerFilter = 'all';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  primaryAction: PageAction = { label: 'Nueva materia', icon: 'add', type: 'flat', color: 'primary' };

  constructor(
    private api: ApiService,
    private toast: Toast,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'name', header: 'Materia', template: this.nameTpl, mobilePrimary: true },
      { key: 'career_name', header: 'Carrera', accessor: (row) => String((row as Subject).career_name) },
      { key: 'semester', header: 'Semestre', accessor: (row) => String((row as Subject).semester ?? '') },
      { key: 'credits', header: 'Créditos', accessor: (row) => String((row as Subject).credits ?? '') },
      { key: 'active', header: 'Estado', template: this.activeTpl },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const [subjects, careers] = await Promise.all([this.api.get<Subject[]>('/subjects'), this.api.get<Career[]>('/careers')]);
      this.items = subjects;
      this.careers = careers;
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar las materias';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): Subject[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => {
      const matchesSearch = !search || [item.name, item.code, item.career_name, item.semester, item.credits, item.active ? 'activa' : 'inactiva'].some((value) => normalizeText(value).includes(search));
      const matchesCareer = this.careerFilter === 'all' || item.career_id === this.careerFilter;
      const matchesStatus = this.statusFilter === 'all' || (this.statusFilter === 'active' ? item.active : !item.active);
      return matchesSearch && matchesCareer && matchesStatus;
    });
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0) + Number(this.careerFilter !== 'all') + Number(this.statusFilter !== 'all');
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay materias';
  }

  get emptyMessage(): string {
    return this.items.length
      ? 'Prueba con otra carrera o limpia los filtros.'
      : 'Crea la primera materia para empezar a usar el listado.';
  }

  get emptyActionLabel(): string {
    return this.activeFilters ? 'Limpiar filtros' : 'Nueva materia';
  }

  initialForSubject(name: string): string {
    return initialFor(name);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.careerFilter = 'all';
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

  async openEdit(subject: Subject): Promise<void> {
    await this.openDialog(subject);
  }

  private async openDialog(subject?: Subject): Promise<void> {
    const ref = this.dialog.open(FormDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        title: subject ? 'Editar materia' : 'Nueva materia',
        subtitle: 'Completa los datos básicos de la materia',
        icon: 'menu_book',
        fields: subjectFields(this.careers),
        values: subject
          ? {
              name: subject.name,
              code: subject.code,
              career_id: subject.career_id,
              semester: subject.semester,
              credits: subject.credits,
              active: subject.active,
            }
          : { name: '', code: '', career_id: this.careers[0]?.id ?? null, semester: null, credits: null, active: true },
        submitLabel: subject ? 'Guardar cambios' : 'Crear materia',
        submit: async (values: Record<string, unknown>) => {
          const payload = toSubjectPayload(values);
          if (subject) {
            await this.api.patch(`/subjects/${subject.id}`, payload);
            this.toast.success('Materia actualizada');
          } else {
            await this.api.post('/subjects', payload);
            this.toast.success('Materia creada');
          }
        },
      },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await this.load();
    }
  }

  async remove(subject: Subject): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialog.openConfirm({
        title: 'Eliminar materia',
        message: `¿Eliminar la materia "${subject.name}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        destructive: true,
        confirmIcon: 'delete',
      }),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.api.delete(`/subjects/${subject.id}`);
      this.toast.success('Materia eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
