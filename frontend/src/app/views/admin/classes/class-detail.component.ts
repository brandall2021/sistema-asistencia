import { CommonModule } from '@angular/common';
import { ElementRef, OnDestroy, OnInit, ViewChild, Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import * as QRCode from 'qrcode';
import { ApiService } from '../../../core/services/api.service';
import { WsService } from '../../../core/services/ws.service';
import { Attendance, ClassSession, ClassStatus, QRData, WSEvent } from '../../../core/models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { Toast } from '../../../shared/toast';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDistance(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }
  return `${Number(value).toFixed(1)} m`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(remaining)}` : `${pad(minutes)}:${pad(remaining)}`;
}

function isAttendancePayload(data: unknown): data is Attendance {
  return !!data && typeof data === 'object' && 'student_name' in data && 'check_in_at' in data;
}

function attendanceSort(left: Attendance, right: Attendance): number {
  return new Date(right.check_in_at).getTime() - new Date(left.check_in_at).getTime();
}

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    PageHeaderComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    @if (loadError) {
      <app-error-state [message]="loadError" retryLabel="Reintentar" (retry)="load()"></app-error-state>
    } @else if (cls) {
      <app-page-header
        [title]="headerTitle"
        [subtitle]="headerSubtitle"
        icon="qr_code_2"
        [breadcrumbs]="breadcrumbs"
      ></app-page-header>

      <section class="detail-layout">
        <div class="main-column">
          <mat-card class="panel qr-panel-card">
            <mat-card-header>
              <mat-card-title>QR en vivo</mat-card-title>
              <mat-card-subtitle>
                @if (qr) {
                  {{ qrStateLabel }} · Vence en {{ qrCountdown }}
                } @else {
                  Generá un QR para habilitar el acceso en el aula.
                }
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div class="qr-meta">
                <app-status-chip [status]="cls.status" kind="class"></app-status-chip>
                <span class="qr-badge" [class.expired]="qrExpired">{{ qrStateLabel }}</span>
                <span class="qr-countdown">{{ qr ? qrCountdown : '--:--' }}</span>
              </div>

              <div #qrBlock class="qr-block" [class.expired]="qrExpired">
                @if (qr) {
                  <img [src]="qr.dataUrl" alt="QR de asistencia" />
                } @else {
                  <div class="qr-placeholder">
                    <mat-icon aria-hidden="true">qr_code_2</mat-icon>
                    <p>La clase está lista para generar un QR dinámico.</p>
                  </div>
                }
              </div>

              <div class="qr-actions">
                <button mat-stroked-button type="button" (click)="toggleFullscreen()" [disabled]="!qr">
                  <mat-icon aria-hidden="true">fullscreen</mat-icon>
                  Pantalla completa
                </button>
                <button mat-flat-button color="primary" type="button" (click)="generateQr()" [disabled]="cls.status !== ClassStatus.ACTIVE">
                  <mat-icon aria-hidden="true">qr_code_2</mat-icon>
                  {{ qrExpired ? 'Regenerar QR' : 'Generar QR' }}
                </button>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel live-card">
            <mat-card-header>
              <mat-card-title>Asistencias en vivo</mat-card-title>
              <mat-card-subtitle>Actualización por WebSocket al escanear el QR</mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              @if (attLoading) {
                <div class="center">
                  <mat-spinner diameter="36"></mat-spinner>
                </div>
              } @else if (attendance.length) {
                <div class="table-scroll">
                  <table mat-table [dataSource]="attendance" class="attendance-table">
                  <ng-container matColumnDef="student_name">
                    <th mat-header-cell *matHeaderCellDef>Estudiante</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="student-cell">
                        <div class="student-name">{{ row.student_name }}</div>
                        <div class="student-meta">{{ row.registration_number }}</div>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="method">
                    <th mat-header-cell *matHeaderCellDef>Método</th>
                    <td mat-cell *matCellDef="let row">{{ row.method }}</td>
                  </ng-container>

                  <ng-container matColumnDef="distance_meters">
                    <th mat-header-cell *matHeaderCellDef>Distancia</th>
                    <td mat-cell *matCellDef="let row">{{ formatDistance(row.distance_meters) }}</td>
                  </ng-container>

                  <ng-container matColumnDef="check_in_at">
                    <th mat-header-cell *matHeaderCellDef>Hora</th>
                    <td mat-cell *matCellDef="let row">{{ formatTime(row.check_in_at) }}</td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Estado</th>
                    <td mat-cell *matCellDef="let row">
                      <app-status-chip [status]="row.status"></app-status-chip>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="attCols"></tr>
                  <tr
                    mat-row
                    *matRowDef="let row; columns: attCols"
                    [class.row-new]="row.id === highlightedAttendanceId"
                  ></tr>
                  </table>
                </div>
              } @else {
                <app-empty-state
                  icon="how_to_reg"
                  title="Sin asistencias"
                  message="Cuando un alumno escanee el QR, aparecerá aquí con resaltado temporal."
                ></app-empty-state>
              }
            </mat-card-content>
          </mat-card>
        </div>

        <aside class="side-column">
          <mat-card class="panel info-card">
            <mat-card-header>
              <mat-card-title>Datos de la clase</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <dl class="info-list">
                <div>
                  <dt>Comisión</dt>
                  <dd>{{ cls.commission_name }}</dd>
                </div>
                <div>
                  <dt>Materia</dt>
                  <dd>{{ cls.subject_name }}</dd>
                </div>
                <div>
                  <dt>Aula</dt>
                  <dd>{{ cls.classroom_name || 'Sin aula' }}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{{ cls.date }}</dd>
                </div>
                <div>
                  <dt>Horario</dt>
                  <dd>{{ scheduleLabel }}</dd>
                </div>
                <div>
                  <dt>Docente</dt>
                  <dd>{{ cls.teacher_name || '-' }}</dd>
                </div>
              </dl>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel metrics-card">
            <mat-card-header>
              <mat-card-title>Métricas</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="metric-item">
                <span>Presentes / Inscriptos</span>
                <strong>{{ cls.attendance_count }} / {{ cls.total_students }}</strong>
              </div>
              <div class="metric-item">
                <span>Asistencia</span>
                <strong>{{ attendanceRate }}%</strong>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="panel actions-card">
            <mat-card-header>
              <mat-card-title>Acciones</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="action-stack">
                <button mat-flat-button color="primary" type="button" (click)="startClass()" [disabled]="cls.status !== ClassStatus.SCHEDULED">
                  <mat-icon aria-hidden="true">play_arrow</mat-icon>
                  Iniciar
                </button>
                <button mat-stroked-button color="warn" type="button" (click)="finishClass()" [disabled]="cls.status !== ClassStatus.ACTIVE">
                  <mat-icon aria-hidden="true">stop</mat-icon>
                  Finalizar
                </button>
                <button mat-stroked-button color="primary" type="button" (click)="generateQr()" [disabled]="cls.status !== ClassStatus.ACTIVE">
                  <mat-icon aria-hidden="true">qr_code_2</mat-icon>
                  Generar QR
                </button>
              </div>
              <p class="action-note">El inicio sigue validando GPS antes de activar la clase.</p>
            </mat-card-content>
          </mat-card>
        </aside>
      </section>
    } @else {
      <div class="center loading-only">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    }

    <ng-template #loadingBlock>
      <div class="center loading-only">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    </ng-template>
  `,
  styles: `
    .detail-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 360px;
      gap: 20px;
      align-items: start;
    }
    .main-column,
    .side-column {
      display: grid;
      gap: 20px;
    }
    .panel {
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
    }
    .qr-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .qr-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--color-success-bg);
      color: var(--color-success);
      font-size: var(--fs-caption);
      font-weight: 600;
    }
    .qr-badge.expired {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }
    .qr-countdown {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .qr-block {
      display: grid;
      place-items: center;
      min-height: 320px;
      padding: 20px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: radial-gradient(circle at top, rgba(59, 130, 246, 0.08), transparent 60%), var(--surface-muted);
    }
    .qr-block.expired {
      opacity: 0.92;
    }
    .qr-block img {
      width: 260px;
      max-width: 100%;
      aspect-ratio: 1;
      border-radius: 18px;
      background: #fff;
      padding: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    }
    .qr-placeholder {
      display: grid;
      justify-items: center;
      gap: 10px;
      text-align: center;
      color: var(--text-secondary);
    }
    .qr-placeholder mat-icon {
      width: 56px;
      height: 56px;
      font-size: 56px;
      color: var(--color-primary-500);
    }
    .qr-placeholder p {
      margin: 0;
      max-width: 280px;
    }
    .qr-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }
    .attendance-table {
      width: 100%;
    }
    .table-scroll {
      overflow: auto;
    }
    .student-cell {
      display: grid;
      gap: 2px;
    }
    .student-name {
      font-weight: 600;
    }
    .student-meta {
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .row-new {
      animation: row-new 1s ease-out;
    }
    .info-list {
      display: grid;
      gap: 12px;
      margin: 0;
    }
    .info-list div {
      display: grid;
      gap: 4px;
    }
    .info-list dt {
      color: var(--text-tertiary);
      font-size: var(--fs-caption);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }
    .info-list dd {
      margin: 0;
      color: var(--text-primary);
      font-weight: 500;
    }
    .metric-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .metric-item:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .metric-item span {
      color: var(--text-secondary);
    }
    .metric-item strong {
      font-size: 1.1rem;
      color: var(--text-primary);
    }
    .action-stack {
      display: grid;
      gap: 10px;
    }
    .action-stack button {
      justify-content: flex-start;
    }
    .action-note {
      margin: 12px 0 0;
      color: var(--text-secondary);
      font-size: var(--fs-caption);
    }
    .center {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 240px;
    }
    .loading-only {
      min-height: 56vh;
    }
    @keyframes row-new {
      0% {
        background: color-mix(in srgb, var(--color-primary-50) 65%, transparent);
      }
      100% {
        background: transparent;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .row-new {
        animation: none;
      }
    }
    @media (max-width: 1199px) {
      .detail-layout {
        grid-template-columns: 1fr;
      }
      .side-column {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 899px) {
      .side-column {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 599px) {
      .qr-block {
        min-height: 260px;
      }
      .qr-block img {
        width: 220px;
      }
      .qr-actions,
      .action-stack {
        width: 100%;
      }
      .qr-actions button,
      .action-stack button {
        width: 100%;
      }
      .attendance-table {
        min-width: 620px;
      }
    }
  `,
})
export class ClassDetailComponent implements OnInit, OnDestroy {
  @ViewChild('qrBlock', { static: false }) qrBlock?: ElementRef<HTMLElement>;

  readonly ClassStatus = ClassStatus;

  classId = '';
  cls: ClassSession | null = null;
  attendance: Attendance[] = [];
  attCols = ['student_name', 'method', 'distance_meters', 'check_in_at', 'status'];
  attLoading = true;
  qr: { dataUrl: string; expires_at: string } | null = null;
  qrSecondsLeft = 0;
  qrExpired = false;
  highlightedAttendanceId: string | null = null;
  loadError = '';

  private wsSub?: Subscription;
  private qrTimerId: number | null = null;
  private highlightTimerId: number | null = null;
  private qrExpiresAt = 0;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private ws: WsService,
    private toast: Toast,
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.classId) {
      this.loadError = 'Clase no encontrada';
      return;
    }
    void this.load();
    this.wsSub = this.ws.connect(this.classId).subscribe((event) => this.onWsEvent(event));
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.ws.disconnect();
    this.clearQrTimer();
    if (this.highlightTimerId) {
      window.clearTimeout(this.highlightTimerId);
      this.highlightTimerId = null;
    }
  }

  get headerTitle(): string {
    if (!this.cls) {
      return 'Clase';
    }
    return `${this.cls.subject_name} · ${this.cls.commission_name}`;
  }

  get headerSubtitle(): string {
    if (!this.cls) {
      return '';
    }
    return `${this.cls.date} · ${this.scheduleLabel} · ${this.cls.classroom_name || 'Sin aula'} · Docente: ${this.cls.teacher_name || '-'}`;
  }

  get breadcrumbs(): { label: string; route?: string }[] {
    return [
      { label: 'Clases', route: '/admin/classes' },
      { label: this.cls ? this.cls.commission_name || 'Detalle' : 'Detalle' },
    ];
  }

  get scheduleLabel(): string {
    if (!this.cls) {
      return '-';
    }
    return `${formatTime(this.cls.starts_at)}${this.cls.ends_at ? ` - ${formatTime(this.cls.ends_at)}` : ''}`;
  }

  get attendanceRate(): string {
    if (!this.cls?.total_students) {
      return '0';
    }
    return Math.round((this.cls.attendance_count / this.cls.total_students) * 100).toString();
  }

  get qrCountdown(): string {
    return formatDuration(this.qrSecondsLeft);
  }

  get qrStateLabel(): string {
    if (!this.qr) {
      return 'Sin QR';
    }
    return this.qrExpired ? 'Vencido' : 'Vigente';
  }

  async load(): Promise<void> {
    this.loadError = '';
    try {
      this.cls = await this.api.get<ClassSession>(`/classes/${this.classId}`);
      await this.loadAttendance();
    } catch (error: any) {
      this.loadError = error?.error?.detail || 'Error al cargar la clase';
    }
  }

  async loadAttendance(): Promise<void> {
    this.attLoading = true;
    try {
      const list = await this.api.get<Attendance[]>(`/classes/${this.classId}/attendance`);
      this.attendance = [...list].sort(attendanceSort);
      if (this.cls) {
        this.cls.attendance_count = this.attendance.length;
      }
    } catch {
      this.attendance = [];
    } finally {
      this.attLoading = false;
    }
  }

  async startClass(): Promise<void> {
    try {
      const pos = await this.getPosition();
      await this.api.post(`/classes/${this.classId}/start`, { latitude: pos.latitude, longitude: pos.longitude });
      this.toast.success('Clase iniciada');
      await this.load();
    } catch (error: any) {
      this.toast.error(error?.error?.detail || 'No se pudo iniciar la clase (GPS)');
    }
  }

  async finishClass(): Promise<void> {
    try {
      await this.api.post(`/classes/${this.classId}/finish`, {});
      this.toast.success('Clase finalizada');
      this.clearQrState();
      await this.load();
    } catch (error: any) {
      this.toast.error(error?.error?.detail || 'No se pudo finalizar la clase');
    }
  }

  async generateQr(): Promise<void> {
    try {
      const data = await this.api.post<QRData>(`/classes/${this.classId}/qr`, {});
      const dataUrl = await QRCode.toDataURL(data.token, { width: 300, margin: 2 });
      this.qr = { dataUrl, expires_at: data.expires_at };
      this.qrExpiresAt = new Date(data.expires_at).getTime();
      this.startQrTimer();
    } catch (error: any) {
      this.toast.error(error?.error?.detail || 'No se pudo generar el QR');
    }
  }

  async toggleFullscreen(): Promise<void> {
    const element = this.qrBlock?.nativeElement;
    if (!element || !this.qr) {
      return;
    }
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      this.toast.error('No se pudo abrir la pantalla completa');
    }
  }

  formatTime(value?: string | null): string {
    return formatTime(value);
  }

  formatDistance(value?: number | null): string {
    return formatDistance(value);
  }

  private onWsEvent(event: WSEvent): void {
    if (event.event === 'checkin' && isAttendancePayload(event.data)) {
      this.upsertAttendance(event.data);
      return;
    }

    if (event.event === 'class-started' || event.event === 'class-update') {
      void this.load();
    }
  }

  private upsertAttendance(attendance: Attendance): void {
    this.attendance = [attendance, ...this.attendance.filter((row) => row.id !== attendance.id)].sort(attendanceSort);
    if (this.cls) {
      this.cls.attendance_count = this.attendance.length;
    }
    this.highlightAttendance(attendance.id);
  }

  private highlightAttendance(id: string): void {
    this.highlightedAttendanceId = id;
    if (this.highlightTimerId) {
      window.clearTimeout(this.highlightTimerId);
    }
    this.highlightTimerId = window.setTimeout(() => {
      if (this.highlightedAttendanceId === id) {
        this.highlightedAttendanceId = null;
      }
      this.highlightTimerId = null;
    }, 1000);
  }

  private startQrTimer(): void {
    this.clearQrTimer();
    this.updateQrCountdown();
    this.qrTimerId = window.setInterval(() => this.updateQrCountdown(), 1000);
  }

  private updateQrCountdown(): void {
    const remaining = Math.max(0, Math.ceil((this.qrExpiresAt - Date.now()) / 1000));
    this.qrSecondsLeft = remaining;
    this.qrExpired = remaining === 0;
    if (remaining === 0) {
      this.clearQrTimer();
    }
  }

  private clearQrTimer(): void {
    if (this.qrTimerId != null) {
      window.clearInterval(this.qrTimerId);
      this.qrTimerId = null;
    }
  }

  private clearQrState(): void {
    this.qr = null;
    this.qrExpiresAt = 0;
    this.qrSecondsLeft = 0;
    this.qrExpired = false;
    this.clearQrTimer();
  }

  private getPosition(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }
}
