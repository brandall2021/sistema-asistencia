import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { WsService } from './ws.service';
import { Toast } from '../../shared/toast';
import { WSEvent } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private subscription: Subscription | null = null;

  constructor(private ws: WsService, private toast: Toast) {}

  start(): void {
    if (this.subscription) {
      return;
    }
    this.subscription = this.ws.connectNotifications().subscribe((ev) => this.handle(ev));
  }

  private handle(ev: WSEvent): void {
    const msg = this.messageFor(ev);
    if (msg) {
      this.toast.success(msg);
    }
  }

  private messageFor(ev: WSEvent): string | null {
    const d = (ev.data ?? {}) as Record<string, unknown>;
    switch (ev.event) {
      case 'class-started':
        return d['subject']
          ? `Comenzó "${d['subject']}" (${d['commission'] ?? ''}).`
          : 'Comenzó una de tus clases.';
      case 'checkin_confirmed':
        return d['status'] === 'LATE'
          ? 'Asistencia registrada como llegada tarde.'
          : 'Asistencia registrada.';
      default:
        return null;
    }
  }
}
