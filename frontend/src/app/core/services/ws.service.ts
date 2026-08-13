import { Injectable } from '@angular/core';
import { Observable, Subject, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { WSEvent } from '../models';

@Injectable({ providedIn: 'root' })
export class WsService {
  private socket: WebSocket | null = null;
  private events = new Subject<WSEvent>();
  private retries = 0;
  private classId: string | null = null;

  constructor(private auth: AuthService) {}

  connect(classId: string): Observable<WSEvent> {
    this.classId = classId;
    this.retries = 0;
    this.open();
    return this.events.asObservable();
  }

  disconnect(): void {
    this.classId = null;
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }

  ping(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send('ping');
    }
  }

  private open(): void {
    const token = this.auth.accessToken;
    if (!this.classId || !token) {
      return;
    }
    const url = `${environment.wsUrl}/ws/classes/${this.classId}?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(url);
    this.socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as WSEvent;
        this.events.next(data);
      } catch {
        /* ignorar mensajes no JSON */
      }
    };
    this.socket.onclose = () => {
      if (this.classId && this.retries < 5) {
        this.retries++;
        timer(1000 * this.retries).subscribe(() => this.open());
      }
    };
    this.socket.onerror = () => {
      this.socket?.close();
    };
  }
}
