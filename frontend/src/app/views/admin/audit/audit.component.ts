import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { AuditLog } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Auditoría</mat-card-title>
        <mat-card-subtitle>Registro de acciones sensibles del sistema</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline" class="filter"><mat-label>Usuario (email)</mat-label><input matInput [(ngModel)]="userEmail" /></mat-form-field>
          <mat-form-field appearance="outline" class="filter"><mat-label>Entidad</mat-label><input matInput [(ngModel)]="entity" /></mat-form-field>
          <mat-form-field appearance="outline" class="filter"><mat-label>Acción</mat-label><input matInput [(ngModel)]="action" /></mat-form-field>
          <button mat-raised-button color="primary" (click)="load()">Filtrar</button>
        </div>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="created_at"><th mat-header-cell *matHeaderCellDef>Fecha</th><td mat-cell *matCellDef="let a">{{ a.created_at | date:'medium' }}</td></ng-container>
          <ng-container matColumnDef="user_email"><th mat-header-cell *matHeaderCellDef>Usuario</th><td mat-cell *matCellDef="let a">{{ a.user_email }}</td></ng-container>
          <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>Acción</th><td mat-cell *matCellDef="let a">{{ a.action }}</td></ng-container>
          <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>Entidad</th><td mat-cell *matCellDef="let a">{{ a.entity }} {{ a.entity_id ? '· ' + a.entity_id.slice(0,8) : '' }}</td></ng-container>
          <ng-container matColumnDef="details"><th mat-header-cell *matHeaderCellDef>Detalle</th><td mat-cell *matCellDef="let a">{{ a.details }}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .filters { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
    .filter { width: 200px; }
    table { width: 100%; }
    .center { display: flex; justify-content: center; padding: 24px; }
  `,
})
export class AuditComponent implements OnInit {
  items: AuditLog[] = [];
  columns = ['created_at', 'user_email', 'action', 'entity', 'details'];
  loading = true;
  userEmail = '';
  entity = '';
  action = '';

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<AuditLog[]>('/audit', {
        user_email: this.userEmail,
        entity: this.entity,
        action: this.action,
      });
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'No se pudieron cargar los registros');
    } finally {
      this.loading = false;
    }
  }
}
