import { Injectable, InjectionToken, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ConfirmDialogComponent, ConfirmData } from './confirm-dialog.component';

export const CONFIRM_SUBMITTING = new InjectionToken<Observable<boolean>>('CONFIRM_SUBMITTING');

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  openConfirm(data: ConfirmData, submitting$?: Observable<boolean>): Observable<boolean> {
    return this.dialog
      .open(ConfirmDialogComponent, {
        data,
        width: '420px',
        maxWidth: '92vw',
        autoFocus: data.destructive ? '[data-confirm-cancel]' : 'first-tabbable',
        injector: submitting$
          ? Injector.create({ providers: [{ provide: CONFIRM_SUBMITTING, useValue: submitting$ }] })
          : undefined,
      })
      .afterClosed()
      .pipe(filter((v): v is boolean => typeof v === 'boolean'));
  }
}
