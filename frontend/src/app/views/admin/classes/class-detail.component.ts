import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import * as QRCode from 'qrcode';
import { ApiService } from '../../../core/services/api.service';
import { WsService } from '../../../core/services/ws.service';
import { Toast } from '../../../shared/toast';
import { Attendance, ClassSession, QRData } from '../../../core/models';

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div *ngIf="cls; else loadingBlock">
      <mat-card class="head">
        <mat-card-header>
          <mat-card-title>{{ cls.subject_name }} — {{ cls.commission_name }}</mat-card-title>
          <mat-card-subtitle>
            {{ cls.date }} · {{ cls.classroom_name || 'Sin aula' }} · Docente: {{ cls.teacher_name }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="status-row">
            <span class="chip" [class.act]="cls.status === 'ACTIVE'">{{ cls.status }}</span>
            <span>Presentes: {{ cls.attendance_count }} / {{ cls.total_students }}</span>
          </div>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="startClass()" [disabled]="cls.status !== 'SCHEDULED'">
              <mat-icon>play_arrow</mat-icon> Iniciar clase
            </button>
            <button mat-raised-button color="warn" (click)="finishClass()" [disabled]="cls.status !== 'ACTIVE'">
              <mat-icon>stop</mat-icon> Finalizar clase
            </button>
            <button mat-raised-button color="accent" (click)="generateQr()" [disabled]="cls.status !== 'ACTIVE'">
              <mat-icon>qr_code_2</mat-icon> Generar QR
            </button>
          </div>
          <div *ngIf="qr" class="qr-block">
            <img [src]="qr.dataUrl" alt="QR de asistencia" />
            <p>Escaneá este código con la app. Vence: {{ qr.expires_at | date:'short' }}</p>
            <button mat-button (click)="qr = null">Ocultar QR</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Asistencia de la clase</mat-card-title>
          <mat-card-subtitle>Actualización en tiempo real</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="attendance" class="mat-elevation-z2">
            <ng-container matColumnDef="student_name"><th mat-header-cell *matHeaderCellDef>Estudiante</th><td mat-cell *matCellDef="let a">{{ a.student_name }}</td></ng-container>
            <ng-container matColumnDef="registration_number"><th mat-header-cell *matHeaderCellDef>Legajo</th><td mat-cell *matCellDef="let a">{{ a.registration_number }}</td></ng-container>
            <ng-container matColumnDef="check_in_at"><th mat-header-cell *matHeaderCellDef>Hora</th><td mat-cell *matCellDef="let a">{{ (a.check_in_at | date:'short') || '-' }}</td></ng-container>
            <ng-container matColumnDef="method"><th mat-header-cell *matHeaderCellDef>Método</th><td mat-cell *matCellDef="let a">{{ a.method }}</td></ng-container>
            <ng-container matColumnDef="distance_meters"><th mat-header-cell *matHeaderCellDef>Distancia (m)</th><td mat-cell *matCellDef="let a">{{ a.distance_meters?.toFixed(1) || '-' }}</td></ng-container>
            <ng-container matColumnDef="status"><th mat-header-cell *matHeaderCellDef>Estado</th><td mat-cell *matCellDef="let a"><span class="chip" [class.late]="a.status === 'LATE'">{{ a.status }}</span></td></ng-container>
            <tr mat-header-row *matHeaderRowDef="attCols"></tr>
            <tr mat-row *matRowDef="let row; columns: attCols"></tr>
          </table>
          <div *ngIf="attLoading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
        </mat-card-content>
      </mat-card>
    </div>

    <ng-template #loadingBlock>
      <div class="center"><mat-spinner diameter="40"></mat-spinner></div>
    </ng-template>
  `,
  styles: `
    .head { margin-bottom: 16px; }
    .status-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
    .actions { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
    .qr-block { text-align: center; margin-top: 16px; }
    .qr-block img { width: 220px; height: 220px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    .chip { background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; }
    .chip.act { background: #dcfce7; color: #166534; }
    .chip.late { background: #fef3c7; color: #92400e; }
    table { width: 100%; }
    .center { display: flex; justify-content: center; padding: 32px; }
  `,
})
export class ClassDetailComponent implements OnInit, OnDestroy {
  classId = '';
  cls: ClassSession | null = null;
  attendance: Attendance[] = [];
  attCols = ['student_name', 'registration_number', 'check_in_at', 'method', 'distance_meters', 'status'];
  attLoading = true;
  qr: { dataUrl: string; expires_at: string } | null = null;
  startCoords: { latitude: number; longitude: number } | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private ws: WsService,
    private toast: Toast,
  ) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
    this.ws.connect(this.classId).subscribe((ev) => {
      if (ev.event === 'checkin') {
        this.loadAttendance();
      }
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }

  async load(): Promise<void> {
    try {
      this.cls = await this.api.get<ClassSession>(`/classes/${this.classId}`);
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al cargar la clase');
    }
    await this.loadAttendance();
  }

  async loadAttendance(): Promise<void> {
    this.attLoading = true;
    try {
      this.attendance = await this.api.get<Attendance[]>(`/classes/${this.classId}/attendance`);
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
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'No se pudo iniciar la clase (GPS)');
    }
  }

  async finishClass(): Promise<void> {
    try {
      await this.api.post(`/classes/${this.classId}/finish`, {});
      this.toast.success('Clase finalizada');
      this.qr = null;
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'No se pudo finalizar la clase');
    }
  }

  async generateQr(): Promise<void> {
    try {
      const data = await this.api.post<QRData>(`/classes/${this.classId}/qr`, {});
      const dataUrl = await QRCode.toDataURL(data.token, { width: 300, margin: 2 });
      this.qr = { dataUrl, expires_at: data.expires_at };
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'No se pudo generar el QR');
    }
  }

  private getPosition(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }
}
