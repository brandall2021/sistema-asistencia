import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageAction } from '../page-header/page-header.component';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="filter-bar">
      <div class="filter-row">
        <mat-form-field class="search-field" appearance="outline" subscriptSizing="dynamic">
          <mat-icon matPrefix aria-hidden="true">search</mat-icon>
          <input
            matInput
            [placeholder]="searchPlaceholder"
            [value]="searchValue"
            [attr.aria-label]="searchPlaceholder"
            (input)="onSearchInput($any($event.target).value)"
          />
          @if (hasSearch) {
            <button matSuffix type="button" mat-icon-button [attr.aria-label]="'Limpiar búsqueda'" (click)="clearSearch()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <div class="filters">
          <ng-content></ng-content>
        </div>

        @if (showClearFilters) {
          <button type="button" mat-stroked-button (click)="clearFilters.emit()">
            <mat-icon aria-hidden="true">filter_alt_off</mat-icon>
            <span>Limpiar</span>
          </button>
        }

        <span class="result-count">{{ resultCount }} resultados</span>

        @if (primaryAction) {
          <ng-container *ngTemplateOutlet="primaryBtn"></ng-container>
        }
      </div>
    </div>

    <ng-template #primaryBtn>
      @switch (primaryAction?.type ?? 'flat') {
        @case ('raised') {
          <button type="button" mat-raised-button [color]="primaryAction!.color || null" [disabled]="primaryAction!.disabled" (click)="primaryClick.emit()">
            <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
          </button>
        }
        @case ('stroked') {
          <button type="button" mat-stroked-button [color]="primaryAction!.color || null" [disabled]="primaryAction!.disabled" (click)="primaryClick.emit()">
            <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
          </button>
        }
        @case ('basic') {
          <button type="button" mat-button [color]="primaryAction!.color || null" [disabled]="primaryAction!.disabled" (click)="primaryClick.emit()">
            <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
          </button>
        }
        @default {
          <button type="button" mat-flat-button [color]="primaryAction!.color || null" [disabled]="primaryAction!.disabled" (click)="primaryClick.emit()">
            <ng-container *ngTemplateOutlet="primaryContent"></ng-container>
          </button>
        }
      }
    </ng-template>

    <ng-template #primaryContent>
      @if (primaryAction?.loading) {
        <mat-spinner diameter="16" class="btn-spinner"></mat-spinner>
      } @else {
        @if (primaryAction?.icon) {
          <mat-icon aria-hidden="true">{{ primaryAction?.icon }}</mat-icon>
        }
        <span>{{ primaryAction?.label }}</span>
      }
    </ng-template>
  `,
  styles: `
    .filter-bar {
      margin-bottom: 16px;
    }
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .search-field {
      width: 280px;
      max-width: 100%;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .result-count {
      margin-left: auto;
      font-size: var(--fs-caption);
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    .btn-spinner {
      margin-right: 8px;
    }
    @media (max-width: 599px) {
      .filter-row {
        flex-direction: column;
        align-items: stretch;
      }
      .search-field {
        width: 100%;
      }
      .filters {
        width: 100%;
      }
      .result-count {
        margin-left: 0;
      }
      .filter-row .mdc-button {
        width: 100%;
      }
    }
  `,
})
export class FilterBarComponent implements OnInit, OnDestroy {
  @Input() searchPlaceholder = 'Buscar…';
  @Input() searchValue = '';
  @Output() searchValueChange = new EventEmitter<string>();
  @Input() resultCount = 0;
  @Input() activeFilters = 0;
  @Input() primaryAction?: PageAction;
  @Output() primaryClick = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() search = new EventEmitter<string>();

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe((value) => this.search.emit(value));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(value: string): void {
    this.searchValue = value;
    this.searchValueChange.emit(value);
    this.search$.next(value);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.searchValueChange.emit('');
    this.search$.next('');
  }

  get hasSearch(): boolean {
    return this.searchValue.length > 0;
  }

  get showClearFilters(): boolean {
    return this.activeFilters > 0 || this.hasSearch;
  }
}
