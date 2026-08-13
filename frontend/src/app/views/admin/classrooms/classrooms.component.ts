import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Classroom } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-classrooms',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatCardModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Aulas</mat-card-title>
        <mat-card-subtitle>Ubicación geográfica y radio de tolerancia por aula</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()"><mat-icon>add</mat-icon> Nueva aula</button>
        </div>
        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput [(ngModel)]="form.name" name="name" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Código</mat-label><input matInput [(ngModel)]="form.code" name="code" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Edificio</mat-label><input matInput [(ngModel)]="form.building" name="building" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Piso</mat-label><input matInput [(ngModel)]="form.floor" name="floor" /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Latitud</mat-label><input matInput [(ngModel)]="form.latitude" name="latitude" type="number" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Longitud</mat-label><input matInput [(ngModel)]="form.longitude" name="longitude" type="number" required /></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Radio (metros)</mat-label><input matInput [(ngModel)]="form.radius_meters" name="radius_meters" type="number" /></mat-form-field>
          <mat-checkbox [(ngModel)]="form.active" name="active">Activa</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Nombre</th><td mat-cell *matCellDef="let c">{{ c.name }}</td></ng-container>
          <ng-container matColumnDef="code"><th mat-header-cell *matHeaderCellDef>Código</th><td mat-cell *matCellDef="let c">{{ c.code }}</td></ng-container>
          <ng-container matColumnDef="building"><th mat-header-cell *matHeaderCellDef>Edificio</th><td mat-cell *matCellDef="let c">{{ c.building }} {{ c.floor ? '-' + c.floor : '' }}</td></ng-container>
          <ng-container matColumnDef="location"><th mat-header-cell *matHeaderCellDef>Ubicación</th><td mat-cell *matCellDef="let c">{{ c.latitude?.toFixed(5) }}, {{ c.longitude?.toFixed(5) }}</td></ng-container>
          <ng-container matColumnDef="radius_meters"><th mat-header-cell *matHeaderCellDef>Radio (m)</th><td mat-cell *matCellDef="let c">{{ c.radius_meters }}</td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Activa</th><td mat-cell *matCellDef="let c"><mat-icon [style.color]="c.active ? 'green' : 'red'">{{ c.active ? 'check_circle' : 'cancel' }}</mat-icon></td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Acciones</th><td mat-cell *matCellDef="let c">
            <button mat-icon-button (click)="edit(c)"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="warn" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `.toolbar { margin: 16px 0; } .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; } .actions { display: flex; align-items: center; gap: 8px; } table { width: 100%; } .center { display: flex; justify-content: center; padding: 24px; }`,
})
export class ClassroomsComponent implements OnInit {
  items: Classroom[] = [];
  columns = ['name', 'code', 'building', 'location', 'radius_meters', 'active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { name: '', code: '', building: '', floor: '', latitude: null, longitude: null, radius_meters: null, active: true };

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<Classroom[]>('/classrooms');
    } catch {
      this.toast.error('No se pudieron cargar las aulas');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { name: '', code: '', building: '', floor: '', latitude: null, longitude: null, radius_meters: null, active: true };
    this.formVisible = true;
  }

  edit(c: Classroom): void {
    this.editingId = c.id;
    this.form = { name: c.name, code: c.code, building: c.building, floor: c.floor, latitude: c.latitude, longitude: c.longitude, radius_meters: c.radius_meters, active: c.active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        await this.api.patch(`/classrooms/${this.editingId}`, this.form);
        this.toast.success('Aula actualizada');
      } else {
        await this.api.post('/classrooms', this.form);
        this.toast.success('Aula creada');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(c: Classroom): Promise<void> {
    if (!confirm(`¿Eliminar el aula ${c.name}?`)) return;
    try {
      await this.api.delete(`/classrooms/${c.id}`);
      this.toast.success('Aula eliminada');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
