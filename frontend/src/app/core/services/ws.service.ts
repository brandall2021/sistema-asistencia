import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { WSEvent } from '../models';

@Injectable({ providedIn: 'root' })
export class WsService {
  private classEvents = new Subject<WSEvent>();
  private notifEvents = new Subject<WSEvent>();
  private classSocket: WebSocket | null = null;
  private notifSocket: WebSocket | null = null;
  private classId: string | null = null;
  private classRetries = 0;
  private notifRetries = 0;

  constructor(private auth: AuthService, private api: ApiService) {}

  connect(classId: string): Observable<WSEvent> {
    this.classId = classId;
    this.classRetries = 0;
    void this.openClass();
    return this.classEvents.asObservable();
  }

  connectNotifications(): Observable<WSEvent> {
    this.notifRetries = 0;
    void this.openNotifications();
    return this.notifEvents.asObservable();
  }

  disconnect(): void {
    this.classId = null;
    if (this.classSocket) {
      this.classSocket.onclose = null;
      this.classSocket.close();
      this.classSocket = null;
    }
  }

  disconnectNotifications(): void {
    if (this.notifSocket) {
      this.notifSocket.onclose = null;
      this.notifSocket.close();
      this.notifSocket = null;
    }
  }

  ping(): void {
    if (this.classSocket && this.classSocket.readyState === WebSocket.OPEN) {
      this.classSocket.send('ping');
    }
    if (this.notifSocket && this.notifSocket.readyState === WebSocket.OPEN) {
      this.notifSocket.send('ping');
    }
  }

  private async openClass(): Promise<void> {
    if (!this.auth.isAuthenticated() || !this.classId) {
      return;
    }
    try {
      const { ticket } = await this.api.getWsTicket(this.classId);
      const url = `${environment.wsUrl}/ws/classes/${this.classId}?ticket=${encodeURIComponent(ticket)}`;
      const socket = new WebSocket(url);
      this.classSocket = socket;
      socket.onmessage = (ev) => this.emit(this.classEvents, ev);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.classSocket === socket) {
          this.classSocket = null;
        }
        if (this.classId) {
          this.retry(() => this.openClass(), ++this.classRetries);
        }
      };
    } catch {
      this.retry(() => this.openClass(), ++this.classRetries);
    }
  }

  private async openNotifications(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    try {
      const { ticket } = await this.api.getWsTicket();
      const url = `${environment.wsUrl}/ws/notifications?ticket=${encodeURIComponent(ticket)}`;
      const socket = new WebSocket(url);
      this.notifSocket = socket;
      socket.onmessage = (ev) => this.emit(this.notifEvents, ev);
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.notifSocket === socket) {
          this.notifSocket = null;
        }
        this.retry(() => this.openNotifications(), ++this.notifRetries);
      };
    } catch {
      this.retry(() => this.openNotifications(), ++this.notifRetries);
    }
  }

  private retry(fn: () => void, attempt: number): void {
    if (attempt <= 5) {
      timer(1000 * attempt).subscribe(() => fn());
    }
  }

  private emit(subject: Subject<WSEvent>, ev: MessageEvent): void {
    try {
      subject.next(JSON.parse(ev.data) as WSEvent);
    } catch {
      /* ignorar mensajes no JSON */
    }
  }
}
