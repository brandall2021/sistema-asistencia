import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="error" role="alert">
      <mat-icon class="error-icon" aria-hidden="true">error_outline</mat-icon>
      <p class="error-message">{{ message }}</p>
      <button type="button" mat-flat-button color="warn" (click)="retry.emit()">{{ retryLabel }}</button>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      padding: 48px 24px;
    }
    .error-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--color-danger);
    }
    .error-message {
      margin: 0;
      max-width: 420px;
      font-size: var(--fs-body);
      color: var(--text-secondary);
    }
  `,
})
export class ErrorStateComponent {
  @Input() message = 'Ocurrió un error al cargar los datos.';
  @Input() retryLabel = 'Reintentar';
  @Output() retry = new EventEmitter<void>();
}
