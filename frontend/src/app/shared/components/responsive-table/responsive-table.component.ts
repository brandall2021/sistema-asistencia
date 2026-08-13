import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  TemplateRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface TableColumn {
  key: string;
  header: string;
  accessor?: (row: unknown) => string;
  template?: TemplateRef<unknown>;
  sortable?: boolean;
  mobilePrimary?: boolean;
  mobileSecondary?: boolean;
  width?: string;
}

@Component({
  selector: 'app-responsive-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    EmptyStateComponent,
  ],
  template: `
    @if (isMobile) {
      <div class="mobile-cards">
        @if (loading) {
          <div class="mobile-card mobile-card-skeleton" *ngFor="let _ of skeletonRows">
            <div class="skeleton sk-line w-md"></div>
            <div class="skeleton sk-line w-sm"></div>
          </div>
        } @else if (total === 0) {
          <app-empty-state [title]="emptyTitle" [message]="emptyMessage"></app-empty-state>
        } @else {
          <div class="mobile-card" *ngFor="let row of rows; trackBy: trackFn">
            <div class="card-main">
              <ng-container *ngTemplateOutlet="cellTpl; context: { col: primaryCol, row: row }"></ng-container>
            </div>
            <div class="card-sub" *ngFor="let col of secondaryCols">
              <ng-container *ngTemplateOutlet="cellTpl; context: { col: col, row: row }"></ng-container>
            </div>
            <div class="card-extra" *ngIf="extraCols.length">
              <div class="card-extra-item" *ngFor="let col of extraCols">
                <span class="card-extra-label">{{ col.header }}</span>
                <span class="card-extra-value">
                  <ng-container *ngTemplateOutlet="cellTpl; context: { col: col, row: row }"></ng-container>
                </span>
              </div>
            </div>
            <div class="card-actions" *ngIf="actionsTemplate">
              <ng-container *ngTemplateOutlet="actionsTemplate; context: { $implicit: row }"></ng-container>
            </div>
          </div>
        }
      </div>

      <div class="mobile-pager" *ngIf="!loading && total > 0">
        <span class="pager-info">Mostrando {{ pagerStart }}–{{ pagerEnd }} de {{ total }}</span>
        <div class="pager-buttons">
          <button type="button" mat-stroked-button (click)="prevPage()" [disabled]="pageIndex <= 0">Anterior</button>
          <button type="button" mat-stroked-button (click)="nextPage()" [disabled]="pageIndex >= lastPage">Siguiente</button>
        </div>
      </div>
    } @else {
      <div class="table-scroll">
        <table mat-table matSort [dataSource]="loading ? [] : rows" (matSortChange)="onSort($event)" class="responsive-table">
          <ng-container *ngFor="let col of columns" [matColumnDef]="col.key">
            <th mat-header-cell *matHeaderCellDef [style.width]="col.width">
              @if (sortEnabled && col.sortable !== false) {
                <span mat-sort-header>{{ col.header }}</span>
              } @else {
                <span>{{ col.header }}</span>
              }
            </th>
            <td mat-cell *matCellDef="let row" [style.width]="col.width">
              <ng-container *ngTemplateOutlet="cellTpl; context: { col: col, row: row }"></ng-container>
            </td>
          </ng-container>

          <ng-container *ngIf="actionsTemplate" matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <ng-container *ngTemplateOutlet="actionsTemplate; context: { $implicit: row }"></ng-container>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns" class="table-row"></tr>

          <tr *ngIf="loading" class="mat-mdc-row skeleton-row">
            <td class="mat-mdc-cell" *ngFor="let col of displayedColumns">
              <div class="skeleton sk-cell"></div>
            </td>
          </tr>

          <tr *ngIf="!loading && total === 0" class="mat-mdc-row">
            <td class="mat-mdc-cell empty-cell" [attr.colspan]="displayedColumns.length">
              <app-empty-state [title]="emptyTitle" [message]="emptyMessage"></app-empty-state>
            </td>
          </tr>
        </table>
      </div>

      <mat-paginator
        *ngIf="!loading && total > 0"
        [length]="total"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex"
        [pageSizeOptions]="[5, 10, 20]"
        (page)="onPage($event)"
      ></mat-paginator>
    }

    <ng-template #cellTpl let-col="col" let-row="row">
      @if (col.template) {
        <ng-container *ngTemplateOutlet="col.template; context: { $implicit: row }"></ng-container>
      } @else {
        {{ cellValue(row, col) }}
      }
    </ng-template>
  `,
  styles: `
    .table-scroll {
      overflow: auto;
      max-height: 520px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .responsive-table {
      min-width: 100%;
      width: 100%;
    }
    .responsive-table th.mat-mdc-header-cell {
      background: var(--surface-muted);
      color: var(--text-secondary);
      font-size: var(--fs-caption);
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border-color);
      z-index: 2;
    }
    .responsive-table td.mat-mdc-cell {
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    .responsive-table .mat-mdc-row:hover {
      background: var(--surface-muted);
    }
    .responsive-table .mat-mdc-row .mat-mdc-cell:first-child {
      padding-left: 20px;
    }
    .responsive-table .mat-mdc-row .mat-mdc-cell:last-child {
      padding-right: 20px;
    }
    .skeleton-row .sk-cell {
      height: 18px;
    }
    .empty-cell {
      text-align: center;
    }
    .mobile-cards {
      display: grid;
      gap: 12px;
    }
    .mobile-card {
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      padding: 16px;
    }
    .mobile-card-skeleton {
      display: grid;
      gap: 12px;
    }
    .card-main {
      font-size: var(--fs-card-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-sub {
      margin-top: 4px;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .card-extra {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin-top: 10px;
      font-size: var(--fs-caption);
    }
    .card-extra-label {
      color: var(--text-tertiary);
    }
    .card-extra-value {
      color: var(--text-secondary);
      text-align: right;
    }
    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }
    .mobile-pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 12px;
    }
    .pager-info {
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .pager-buttons {
      display: flex;
      gap: 8px;
    }
  `,
})
export class ResponsiveTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() columns: TableColumn[] = [];
  @Input() data: unknown[] = [];
  @Input() loading = false;
  @Input() trackKey = 'id';
  @Input() emptyTitle = 'Sin resultados';
  @Input() emptyMessage = 'No se encontraron elementos para los filtros aplicados.';
  @Input() actionsTemplate?: TemplateRef<unknown>;
  @Input() pageSize = 10;
  @Input() sortEnabled = true;

  isMobile = false;
  pageIndex = 0;
  sortState: Sort = { active: '', direction: '' };

  private destroy$ = new Subject<void>();

  constructor(private breakpointObserver: BreakpointObserver) {}

  ngOnInit(): void {
    this.breakpointObserver
      .observe('(max-width: 767px)')
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile = result.matches;
        this.clampPage();
      });
  }

  ngOnChanges(): void {
    this.clampPage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get displayedColumns(): string[] {
    const cols = this.columns.map((c) => c.key);
    if (this.actionsTemplate) {
      cols.push('actions');
    }
    return cols;
  }

  get primaryCol(): TableColumn {
    return this.columns.find((c) => c.mobilePrimary) ?? this.columns[0];
  }

  get secondaryCols(): TableColumn[] {
    return this.columns.filter((c) => c.mobileSecondary);
  }

  get extraCols(): TableColumn[] {
    return this.columns.filter((c) => c !== this.primaryCol && !c.mobileSecondary);
  }

  get skeletonRows(): number[] {
    return Array.from({ length: Math.min(this.pageSize, 5) }, (_, i) => i);
  }

  get sortedRows(): unknown[] {
    const s = this.sortState;
    if (!this.sortEnabled || !s.active || !s.direction) {
      return this.data;
    }
    const col = this.columns.find((c) => c.key === s.active);
    if (!col) {
      return this.data;
    }
    const dir = s.direction === 'asc' ? 1 : -1;
    return [...this.data].sort((a, b) => {
      const va = this.cellValue(a, col);
      const vb = this.cellValue(b, col);
      if (va === vb) {
        return 0;
      }
      const na = Number(va);
      const nb = Number(vb);
      const numeric = va !== '' && vb !== '' && !Number.isNaN(na) && !Number.isNaN(nb);
      return (numeric ? na - nb : va.localeCompare(vb, 'es')) * dir;
    });
  }

  get total(): number {
    return this.sortedRows.length;
  }

  get rows(): unknown[] {
    const start = this.pageIndex * this.pageSize;
    return this.sortedRows.slice(start, start + this.pageSize);
  }

  get lastPage(): number {
    return Math.max(0, Math.ceil(this.total / this.pageSize) - 1);
  }

  get pagerStart(): number {
    return this.total === 0 ? 0 : this.pageIndex * this.pageSize + 1;
  }

  get pagerEnd(): number {
    return Math.min((this.pageIndex + 1) * this.pageSize, this.total);
  }

  cellValue(row: unknown, col: TableColumn): string {
    if (col.accessor) {
      return col.accessor(row) ?? '';
    }
    const value = (row as Record<string, unknown>)[col.key];
    return value == null ? '' : String(value);
  }

  trackFn(_: number, row: unknown): unknown {
    const record = row as Record<string, unknown>;
    return record[this.trackKey] ?? row;
  }

  onSort(sort: Sort): void {
    this.sortState = sort;
    this.pageIndex = 0;
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  prevPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex--;
    }
  }

  nextPage(): void {
    if (this.pageIndex < this.lastPage) {
      this.pageIndex++;
    }
  }

  private clampPage(): void {
    const max = Math.max(0, Math.ceil(this.total / this.pageSize) - 1);
    if (this.pageIndex > max) {
      this.pageIndex = max;
    }
  }
}
