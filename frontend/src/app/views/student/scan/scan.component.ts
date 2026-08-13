import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BrowserQRCodeReader } from '@zxing/browser';
import { ApiService } from '../../../core/services/api.service';
import { CheckInResponse } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Escanear QR de asistencia</mat-card-title>
        <mat-card-subtitle>Apuntá la cámara al código QR que muestra el docente</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="scan-content">
        <div *ngIf="!scanning && !checking" class="center">
          <button mat-raised-button color="primary" (click)="startScan()">
            <mat-icon>camera_alt</mat-icon> Activar cámara
          </button>
        </div>
        <video #video [hidden]="!scanning" class="video" autoplay playsinline></video>
        <div *ngIf="checking" class="center">
          <mat-spinner diameter="40"></mat-spinner>
          <p class="hint">Verificando ubicación y asistencia...</p>
        </div>
        <div *ngIf="result" class="result" [class.ok]="result.success">
          <mat-icon>{{ result.success ? 'check_circle' : 'error' }}</mat-icon>
          <p class="status">{{ result.status }}</p>
          <p>{{ result.message }}</p>
        </div>
        <p *ngIf="scanning && !checking" class="hint">Buscando código QR...</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .scan-content { display: flex; flex-direction: column; align-items: center; padding: 16px; }
    .video { width: 100%; max-width: 420px; border-radius: 12px; }
    .center { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; }
    .hint { color: #64748b; margin-top: 8px; }
    .result { margin-top: 16px; padding: 16px 24px; border-radius: 12px; text-align: center; background: #fef3c7; color: #92400e; }
    .result.ok { background: #dcfce7; color: #166534; }
    .result .status { font-weight: 600; margin: 4px 0; }
  `,
})
export class ScanComponent implements OnInit, OnDestroy {
  scanning = false;
  checking = false;
  result: CheckInResponse | null = null;
  private reader: BrowserQRCodeReader | null = null;
  private videoEl: HTMLVideoElement | null = null;

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async startScan(): Promise<void> {
    this.result = null;
    this.checking = false;
    this.scanning = true;
    try {
      this.videoEl = document.querySelector('video') as HTMLVideoElement;
      if (!this.videoEl) {
        throw new Error('video no encontrado');
      }
      this.reader = new BrowserQRCodeReader();
      await this.reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        this.videoEl,
        (result) => { if (result?.getText()) { this.onDecode(result.getText()); } },
      );
    } catch (e) {
      this.scanning = false;
      this.toast.error('No se pudo acceder a la cámara');
    }
  }

  async onDecode(text: string): Promise<void> {
    if (this.checking) {
      return;
    }
    this.checking = true;
    this.stopCamera();
    try {
      const pos = await this.getPosition();
      const resp = await this.api.post<CheckInResponse>('/attendance/check-in', {
        token: text,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      this.result = resp;
      if (resp.success) {
        this.toast.success('Asistencia registrada');
      } else {
        this.toast.error(resp.message);
      }
    } catch (e: any) {
      const detail = e?.error?.detail;
      const message = typeof detail === 'string' ? detail : 'No se pudo registrar la asistencia';
      this.result = { success: false, status: 'ERROR', message, attendance: null };
      this.toast.error(message);
    } finally {
      this.checking = false;
    }
  }

  private getPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  private stopCamera(): void {
    if (this.videoEl && this.videoEl.srcObject) {
      (this.videoEl.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      this.videoEl.srcObject = null;
    }
    this.reader = null;
    this.scanning = false;
  }
}
