import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

import { CheckInResponse } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

type ViewState = 'idle' | 'scanning' | 'checking' | 'success' | 'error';

type CheckStep = 0 | 1 | 2;

interface CameraOption {
  deviceId: string;
  label: string;
}

interface GuidedError {
  title: string;
  message: string;
  action: string;
  cta: string;
}

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <mat-card class="scan-shell">
      <mat-card-content>
        <ng-container [ngSwitch]="view">
          <section *ngSwitchCase="'idle'" #panel class="state state-idle" tabindex="-1" aria-live="polite">
            <div class="hero-icon">
              <mat-icon>qr_code_scanner</mat-icon>
            </div>
            <h2>Escaneá el código mostrado por el docente</h2>
            <p class="note">Necesitaremos acceso a la cámara y ubicación solamente durante el registro.</p>
            <button mat-flat-button color="primary" class="primary-action" (click)="startScan()">
              Activar cámara
            </button>
          </section>

          <section *ngSwitchCase="'scanning'" #panel class="state state-scanning" tabindex="-1" aria-live="polite">
            <div class="scan-stage">
              <video #video class="scan-video" autoplay muted playsinline></video>
              <div class="scan-frame" aria-hidden="true">
                <span class="scan-line"></span>
              </div>
              <div class="scan-overlay">Buscando código…</div>
            </div>

            <div class="scan-toolbar">
              <button
                mat-icon-button
                type="button"
                [disabled]="!torchAvailable"
                [attr.aria-pressed]="torchEnabled"
                [attr.title]="torchAvailable ? (torchEnabled ? 'Apagar linterna' : 'Encender linterna') : 'Linterna no disponible'"
                (click)="toggleTorch()"
              >
                <mat-icon>{{ torchEnabled ? 'flash_off' : 'flash_on' }}</mat-icon>
              </button>

              <mat-form-field appearance="outline" class="camera-select" *ngIf="cameraOptions.length > 1">
                <mat-label>Cámara</mat-label>
                <mat-select [value]="selectedDeviceId" (selectionChange)="changeCamera($event.value)">
                  <mat-option *ngFor="let camera of cameraOptions" [value]="camera.deviceId">{{ camera.label }}</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button type="button" (click)="cancelScan()">Cancelar</button>
            </div>
          </section>

          <section *ngSwitchCase="'checking'" #panel class="state state-checking" tabindex="-1" aria-live="polite" role="status">
            <div class="checking-card">
              <mat-progress-spinner diameter="44" mode="indeterminate"></mat-progress-spinner>
              <div>
                <h2>Registrando asistencia</h2>
                <ul class="steps">
                  <li *ngFor="let step of checkingSteps; let i = index" [class.active]="checkingStep === i" [class.done]="checkingStep > i">
                    <mat-icon>{{ checkingStep > i ? 'check_circle' : checkingStep === i ? 'autorenew' : 'radio_button_unchecked' }}</mat-icon>
                    <span>{{ step }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section *ngSwitchCase="'success'" #panel class="state state-success" tabindex="-1" aria-live="polite" role="status">
            <div class="result-card success">
              <mat-icon>check_circle</mat-icon>
              <h2>Asistencia registrada</h2>
              <p class="message">{{ lastAttendance?.status === 'LATE' ? 'Registrada como tarde' : 'Registrada como presente' }}</p>

              <div class="details" *ngIf="lastAttendance as attendance">
                <div><span>Materia</span><strong>{{ attendance.subject_name }}</strong></div>
                <div><span>Comisión</span><strong>{{ attendance.commission_name }}</strong></div>
                <div><span>Fecha y hora</span><strong>{{ attendance.check_in_at | date: 'short' }}</strong></div>
                <div>
                  <span>Estado</span>
                  <strong><span class="chip" [class.late]="attendance.status === 'LATE'">{{ attendance.status === 'LATE' ? 'Tarde' : 'Presente' }}</span></strong>
                </div>
              </div>

              <a mat-flat-button color="primary" routerLink="/student/history">Ver mi asistencia</a>
            </div>
          </section>

          <section *ngSwitchCase="'error'" #panel class="state state-error" tabindex="-1" [attr.aria-live]="'assertive'" role="alert">
            <div class="result-card error" *ngIf="errorState as error">
              <mat-icon>error</mat-icon>
              <h2>{{ error.title }}</h2>
              <p class="message">{{ error.message }}</p>
              <p class="action">{{ error.action }}</p>
              <div class="actions">
                <a *ngIf="error.cta === 'Ver mi asistencia'" mat-flat-button color="primary" routerLink="/student/history">{{ error.cta }}</a>
                <button *ngIf="error.cta !== 'Ver mi asistencia'" mat-flat-button color="primary" type="button" (click)="retryFromError()">{{ error.cta }}</button>
              </div>
            </div>
          </section>
        </ng-container>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .scan-shell { max-width: 720px; margin: 0 auto; }
    .scan-shell mat-card-content { padding: 20px; }
    .state { display: flex; flex-direction: column; align-items: center; gap: 18px; outline: none; text-align: center; }
    .state h2 { margin: 0; font-size: 1.5rem; line-height: 1.15; }
    .note, .message, .action { margin: 0; color: #64748b; }
    .primary-action { min-height: 52px; padding-inline: 24px; font-size: 1rem; }
    .hero-icon { width: 84px; height: 84px; border-radius: 24px; display: grid; place-items: center; background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(14,165,233,0.2)); color: #0f62fe; }
    .hero-icon mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .scan-stage { position: relative; width: min(100%, 560px); min-height: 320px; border-radius: 24px; overflow: hidden; background: #0f172a; }
    .scan-video { width: 100%; min-height: 320px; height: 100%; object-fit: cover; display: block; background: #020617; }
    .scan-frame { position: absolute; inset: 14%; border: 3px solid rgba(255,255,255,0.92); border-radius: 24px; box-shadow: 0 0 0 999px rgba(2, 6, 23, 0.24); pointer-events: none; }
    .scan-line { position: absolute; left: 10%; right: 10%; top: 16px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, transparent, #22c55e, transparent); animation: scan-line 1.8s ease-in-out infinite; }
    .scan-overlay { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 8px 14px; border-radius: 999px; background: rgba(15, 23, 42, 0.82); color: #fff; font-weight: 600; letter-spacing: 0.01em; }
    .scan-toolbar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; width: 100%; }
    .camera-select { min-width: min(100%, 280px); }
    .checking-card, .result-card { width: min(100%, 560px); padding: 24px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); }
    .checking-card { background: #eff6ff; color: #0f172a; flex-direction: row; text-align: left; align-items: flex-start; }
    .checking-card h2 { margin-bottom: 12px; }
    .steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .steps li { display: flex; align-items: center; gap: 10px; color: #64748b; }
    .steps li mat-icon { width: 20px; height: 20px; font-size: 20px; color: #94a3b8; }
    .steps li.active { color: #0f172a; }
    .steps li.active mat-icon { color: #0f62fe; animation: pulse 1.2s ease-in-out infinite; }
    .steps li.done { color: #166534; }
    .steps li.done mat-icon { color: #16a34a; }
    .result-card.success { background: #dcfce7; color: #14532d; }
    .result-card.error { background: #fee2e2; color: #7f1d1d; }
    .result-card mat-icon { font-size: 52px; width: 52px; height: 52px; }
    .details { width: 100%; display: grid; gap: 12px; text-align: left; }
    .details > div { display: flex; justify-content: space-between; gap: 16px; border-top: 1px solid rgba(15, 23, 42, 0.08); padding-top: 12px; }
    .details span { color: rgba(15, 23, 42, 0.62); font-size: 0.85rem; }
    .details strong { text-align: right; }
    .chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 12px; background: #dcfce7; color: #166534; }
    .chip.late { background: #fef3c7; color: #92400e; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }

    @keyframes scan-line {
      0%, 100% { transform: translateY(0); opacity: 0.65; }
      50% { transform: translateY(calc(100% + 230px)); opacity: 1; }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }

    @media (max-width: 640px) {
      .scan-shell mat-card-content { padding: 14px; }
      .checking-card, .result-card { padding: 20px; }
      .checking-card { flex-direction: column; align-items: center; text-align: center; }
      .details > div { flex-direction: column; align-items: flex-start; }
      .details strong { text-align: left; }
    }

    @media (prefers-reduced-motion: reduce) {
      .scan-line, .steps li.active mat-icon { animation: none; }
    }
  `,
})
export class ScanComponent implements OnDestroy {
  @ViewChild('video') private videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('panel') private panelRef?: ElementRef<HTMLElement>;

  view: ViewState = 'idle';
  checkingStep: CheckStep = 0;
  checkingSteps = ['Verificando QR', 'Comprobando ubicación', 'Registrando asistencia'];
  cameraOptions: CameraOption[] = [];
  selectedDeviceId = '';
  torchAvailable = false;
  torchEnabled = false;
  lastAttendance: CheckInResponse['attendance'] = null;
  errorState: GuidedError | null = null;

  private reader: BrowserQRCodeReader | null = null;
  private controls: IScannerControls | null = null;
  private session = 0;
  private focusTimer: number | null = null;
  private stepTimers: number[] = [];

  constructor(private api: ApiService) {}

  ngOnDestroy(): void {
    this.stopCamera();
    this.clearTimers();
  }

  async startScan(): Promise<void> {
    this.lastAttendance = null;
    this.errorState = null;
    this.checkingStep = 0;
    await this.loadCameraOptions();
    this.view = 'scanning';
    await this.waitForNextFrame();

    const video = this.videoRef?.nativeElement;
    if (!video) {
      this.showCameraError(new Error('VIDEO_NO_DISPONIBLE'));
      return;
    }

    this.stopCamera(false);
    const activeSession = ++this.session;
    this.reader ??= new BrowserQRCodeReader();

    try {
      this.controls = await this.reader.decodeFromVideoDevice(
        this.selectedDeviceId || undefined,
        video,
        (result, error) => {
          if (activeSession !== this.session || this.view !== 'scanning') {
            return;
          }

          if (result?.getText()) {
            void this.handleDecodedText(result.getText(), activeSession);
          }
        },
      );

      this.updateTorchState();
      this.focusPanel();
    } catch (error) {
      this.showCameraError(error);
    }
  }

  async changeCamera(deviceId: string): Promise<void> {
    this.selectedDeviceId = deviceId;
    if (this.view === 'scanning') {
      await this.startScan();
    }
  }

  async toggleTorch(): Promise<void> {
    const track = this.getVideoTrack();
    if (!track || !this.torchAvailable) {
      return;
    }

    const next = !this.torchEnabled;
    try {
      await track.applyConstraints({ torch: next } as any);
      this.torchEnabled = next;
    } catch {
      try {
        await track.applyConstraints({ advanced: [{ torch: next }] } as any);
        this.torchEnabled = next;
      } catch {
        this.torchAvailable = false;
      }
    }
  }

  cancelScan(): void {
    this.stopCamera();
    this.view = 'idle';
    this.focusPanel();
  }

  retryFromError(): void {
    if (this.errorState?.cta === 'Ver mi asistencia') {
      this.view = 'success';
      this.focusPanel();
      return;
    }

    void this.startScan();
  }

  private async handleDecodedText(text: string, session: number): Promise<void> {
    if (this.view !== 'scanning' || session !== this.session) {
      return;
    }

    this.view = 'checking';
    this.checkingStep = 0;
    this.stopCamera(false);
    this.focusPanel();
    this.stepTimers.push(window.setTimeout(() => (this.checkingStep = 1), 180));
    this.stepTimers.push(window.setTimeout(() => (this.checkingStep = 2), 420));

    try {
      const pos = await this.getPosition();
      const resp = await this.api.post<CheckInResponse>('/attendance/check-in', {
        token: text,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });

      this.lastAttendance = resp.attendance;
      if (resp.success) {
        this.view = 'success';
      } else {
        this.errorState = this.mapError(resp.message || resp.status);
        this.view = 'error';
      }
    } catch (error) {
      this.errorState = this.mapError(error);
      this.view = 'error';
    } finally {
      this.stopCamera(false);
      this.focusPanel();
    }
  }

  private mapError(error: unknown): GuidedError {
    const detail = this.extractDetail(error);
    const normalized = this.normalizeDetail(detail);

    if (this.isCameraDenied(error)) {
      return {
        title: 'No pudimos usar la cámara',
        message: 'Activá el permiso de cámara en tu navegador',
        action: 'Revisá la configuración del navegador y volvé a intentarlo.',
        cta: 'Reintentar',
      };
    }

    if (this.isGpsDenied(error) || normalized === 'GPS_DESACTIVADO') {
      return {
        title: 'No pudimos leer tu ubicación',
        message: 'Activá la ubicación del dispositivo',
        action: 'Verificá que el GPS esté encendido y con permiso en el navegador.',
        cta: 'Reintentar',
      };
    }

    switch (normalized) {
      case 'GPS_IMPRECISO':
        return {
          title: 'Precisión insuficiente',
          message: 'Acercate y esperá a que mejore la señal',
          action: 'Buscá un lugar con mejor señal de GPS y probá de nuevo.',
          cta: 'Reintentar',
        };
      case 'FUERA_DEL_AULA':
        return {
          title: 'Fuera del aula',
          message: 'Estás fuera del radio del aula',
          action: 'Volvé a acercarte al aula y probá otra vez.',
          cta: 'Volver a intentar',
        };
      case 'QR_EXPIRADO':
      case 'CLASE_NO_ACTIVA':
        return {
          title: 'El código venció',
          message: 'Pedí un nuevo código al docente',
          action: 'El QR ya no está disponible para registrar asistencia.',
          cta: 'Reintentar',
        };
      case 'QR_INVALIDO':
        return {
          title: 'El código no es válido',
          message: 'Pedí el código correcto al docente',
          action: 'Verificá que estés escaneando el QR de la clase actual.',
          cta: 'Reintentar',
        };
      case 'ASISTENCIA_YA_REGISTRADA':
        return {
          title: 'Ya registraste tu asistencia',
          message: 'Tu presencia ya quedó guardada',
          action: 'Podés abrir tu historial para confirmarlo.',
          cta: 'Ver mi asistencia',
        };
      case 'ALUMNO_NO_INSCRIPTO':
        return {
          title: 'No estás inscripto en esta comisión',
          message: 'Contactá al docente para revisar tu inscripción',
          action: 'No se pudo registrar la asistencia con este QR.',
          cta: 'Reintentar',
        };
      default:
        return {
          title: 'No se pudo registrar la asistencia',
          message: detail || 'Intentá nuevamente en unos segundos',
          action: 'Volvé a intentar el escaneo.',
          cta: 'Reintentar',
        };
    }
  }

  private async getPosition(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS_DESACTIVADO'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  private async loadCameraOptions(): Promise<void> {
    this.cameraOptions = [];
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.cameraOptions = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: this.formatCameraLabel(device.label, index),
        }));

      if (!this.selectedDeviceId && this.cameraOptions.length > 0) {
        this.selectedDeviceId = this.cameraOptions[0].deviceId;
      }
    } catch {
      this.cameraOptions = [];
    }
  }

  private formatCameraLabel(label: string, index: number): string {
    const trimmed = label.trim();
    if (trimmed) {
      return trimmed;
    }

    if (index === 0) {
      return 'Cámara principal';
    }

    return index === 1 ? 'Cámara trasera' : `Cámara ${index + 1}`;
  }

  private updateTorchState(): void {
    const track = this.getVideoTrack();
    const supported = Boolean((navigator.mediaDevices?.getSupportedConstraints?.() as any)?.torch);
    const capabilities = track?.getCapabilities?.() as any;
    const settings = track?.getSettings?.() as any;
    this.torchAvailable = Boolean(track && supported && capabilities?.torch);
    this.torchEnabled = Boolean(settings?.torch);
  }

  private getVideoTrack(): MediaStreamTrack | null {
    const stream = this.videoRef?.nativeElement?.srcObject as MediaStream | null | undefined;
    return stream?.getVideoTracks?.()[0] ?? null;
  }

  private stopCamera(resetView = true): void {
    this.controls?.stop();
    this.controls = null;

    const video = this.videoRef?.nativeElement;
    const stream = video?.srcObject as MediaStream | null | undefined;
    stream?.getTracks().forEach((track) => track.stop());

    if (video) {
      video.srcObject = null;
    }

    this.reader = null;
    this.torchAvailable = false;
    this.torchEnabled = false;
    this.clearTimers();

    if (resetView) {
      this.view = 'idle';
    }
  }

  private clearTimers(): void {
    for (const timer of this.stepTimers) {
      window.clearTimeout(timer);
    }
    this.stepTimers = [];

    if (this.focusTimer !== null) {
      window.clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
  }

  private focusPanel(): void {
    this.clearFocusTimer();
    this.focusTimer = window.setTimeout(() => {
      this.panelRef?.nativeElement?.focus();
    }, 0);
  }

  private clearFocusTimer(): void {
    if (this.focusTimer !== null) {
      window.clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
  }

  private waitForNextFrame(): Promise<void> {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  private showCameraError(error: unknown): void {
    this.errorState = this.mapError(error);
    this.stopCamera(false);
    this.view = 'error';
    this.focusPanel();
  }

  private extractDetail(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const maybeError = error as { error?: { detail?: unknown }; detail?: unknown; message?: unknown };
    const detail = maybeError.error?.detail ?? maybeError.detail ?? maybeError.message;
    return typeof detail === 'string' ? detail : '';
  }

  private normalizeDetail(detail: string): string {
    return detail
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private isCameraDenied(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybe = error as { name?: unknown; message?: unknown };
    const name = typeof maybe.name === 'string' ? maybe.name : '';
    const message = typeof maybe.message === 'string' ? maybe.message.toLowerCase() : '';
    return name === 'NotAllowedError' || name === 'NotFoundError' || message.includes('camera') || message.includes('cámara');
  }

  private isGpsDenied(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybe = error as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof maybe.code === 'number' ? maybe.code : -1;
    const name = typeof maybe.name === 'string' ? maybe.name : '';
    const message = typeof maybe.message === 'string' ? maybe.message.toLowerCase() : '';
    return code === 1 || code === 2 || code === 3 || name === 'NotAllowedError' || message.includes('geoloc') || message.includes('ubicac');
  }
}
