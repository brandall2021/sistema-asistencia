import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="skeleton-wrap" role="status" aria-label="Cargando">
      <div aria-hidden="true">
        <ng-container [ngSwitch]="variant">
          <div *ngSwitchCase="'card'" class="sk-stack">
            <div *ngFor="let row of rowsArray" class="sk-card">
              <div class="skeleton sk-line w-md"></div>
              <div class="skeleton sk-line"></div>
              <div class="skeleton sk-line w-sm"></div>
            </div>
          </div>

          <div *ngSwitchCase="'list'" class="sk-stack">
            <div *ngFor="let row of rowsArray" class="sk-row">
              <div class="skeleton sk-avatar"></div>
              <div class="sk-lines">
                <div class="skeleton sk-line"></div>
                <div class="skeleton sk-line w-sm"></div>
              </div>
            </div>
          </div>

          <div *ngSwitchCase="'table'" class="sk-table">
            <div class="sk-table-row head">
              <div *ngFor="let col of tableCols" class="skeleton"></div>
            </div>
            <div *ngFor="let row of rowsArray" class="sk-table-row">
              <div *ngFor="let col of tableCols" class="skeleton"></div>
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: `
    .skeleton-wrap {
      width: 100%;
    }
    .sk-stack {
      display: grid;
      gap: 16px;
    }
    .sk-card {
      display: grid;
      gap: 12px;
      padding: 20px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
    }
    .sk-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 4px;
    }
    .sk-avatar {
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    .sk-lines {
      display: grid;
      flex: 1;
      gap: 8px;
    }
    .sk-line {
      height: 14px;
    }
    .w-sm {
      width: 40%;
    }
    .w-md {
      width: 70%;
    }
    .sk-table {
      display: grid;
      gap: 8px;
    }
    .sk-table-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .sk-table-row .skeleton {
      height: 16px;
    }
    .sk-table-row.head .skeleton {
      height: 20px;
    }
  `,
})
export class LoadingSkeletonComponent {
  @Input() variant: 'card' | 'list' | 'table' = 'card';
  @Input() rows = 3;

  readonly tableCols = [0, 1, 2, 3];

  get rowsArray(): number[] {
    return Array.from({ length: this.rows }, (_, i) => i);
  }
}
