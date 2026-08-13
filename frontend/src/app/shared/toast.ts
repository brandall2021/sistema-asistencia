import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class Toast {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 3500, panelClass: ['toast-success'] });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Cerrar', { duration: 5000, panelClass: ['toast-error'] });
  }
}
