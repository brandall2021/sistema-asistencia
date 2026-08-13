import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ApiService } from '../../../core/services/api.service';
import { AuditLog, Page } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { FilterBarComponent } from '../../../shared/components/filter-bar/filter-bar.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ResponsiveTableComponent, TableColumn } from '../../../shared/components/responsive-table/responsive-table.component';

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Component({
  selector: 'app-audit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PageHeaderComponent,
    FilterBarComponent,
    ResponsiveTableComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header
      title="Auditoría"
      subtitle="Registro de acciones sensibles del sistema"
      icon="fact_check"
      [breadcrumbs]="breadcrumbs"
    ></app-page-header>

    <app-filter-bar
      searchPlaceholder="Buscar por usuario, acción, entidad o detalle"
      [searchValue]="searchTerm"
      (searchValueChange)="searchTerm = $event"
      [resultCount]="filteredItems.length"
      [activeFilters]="activeFilters"
      (clearFilters)="clearFilters()"
      (search)="searchTerm = $event"
    ></app-filter-bar>

    @if (loading) {
      <app-loading-skeleton variant="table" [rows]="6"></app-loading-skeleton>
    } @else if (loadError) {
      <app-error-state [message]="loadError" (retry)="load()"></app-error-state>
    } @else {
      @if (!filteredItems.length) {
        <app-empty-state [title]="emptyTitle" [message]="emptyMessage"></app-empty-state>
      } @else {
        <app-responsive-table [columns]="columns" [data]="filteredItems" [sortEnabled]="false" [pageSize]="10"></app-responsive-table>
      }
    }
  `,
  styles: ``,
})
export class AuditComponent implements OnInit {
  columns: TableColumn[] = [];
  breadcrumbs = [
    { label: 'Inicio', route: '/home' },
    { label: 'Administración' },
    { label: 'Auditoría' },
  ];

  items: AuditLog[] = [];
  loading = true;
  loadError = '';
  searchTerm = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.columns = [
      { key: 'created_at', header: 'Fecha', accessor: (row) => this.formatDate((row as AuditLog).created_at), mobilePrimary: true },
      { key: 'username', header: 'Usuario', accessor: (row) => String((row as AuditLog).username ?? 'Sistema') },
      { key: 'action', header: 'Acción', accessor: (row) => String((row as AuditLog).action) },
      { key: 'entity', header: 'Entidad', accessor: (row) => String((row as AuditLog).entity) },
      { key: 'details', header: 'Detalle', accessor: (row) => String((row as AuditLog).details ?? '') },
    ];
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const firstPage = await this.api.get<Page<AuditLog>>('/audit', { page: 1, page_size: 200 });
      const pages = Math.max(1, firstPage.pages ?? 1);
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, index) => this.api.get<Page<AuditLog>>('/audit', { page: index + 2, page_size: firstPage.page_size })),
      );
      this.items = [firstPage.items, ...rest.map((page) => page.items)].flat();
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'No se pudieron cargar los registros';
    } finally {
      this.loading = false;
    }
  }

  get filteredItems(): AuditLog[] {
    const search = normalizeText(this.searchTerm);
    return this.items.filter((item) => !search || [item.username, item.action, item.entity, item.details, item.ip, item.user_agent].some((value) => normalizeText(value).includes(search)));
  }

  get activeFilters(): number {
    return Number(this.searchTerm.trim().length > 0);
  }

  get emptyTitle(): string {
    return this.items.length ? 'Sin coincidencias' : 'Todavía no hay registros';
  }

  get emptyMessage(): string {
    return this.items.length ? 'Prueba con otra búsqueda o limpia el filtro.' : 'Los eventos aparecerán aquí cuando el sistema registre acciones.';
  }

  clearFilters(): void {
    this.searchTerm = '';
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}
