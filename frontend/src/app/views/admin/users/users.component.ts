import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { RoleName, User } from '../../../core/models';
import { Toast } from '../../../shared/toast';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Usuarios</mat-card-title>
        <mat-card-subtitle>Gestión de cuentas y roles del sistema</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="toolbar">
          <button mat-flat-button color="primary" (click)="openCreate()">
            <mat-icon>add</mat-icon> Nuevo usuario
          </button>
        </div>

        <form *ngIf="formVisible" (ngSubmit)="save()" class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Nombre completo</mat-label>
            <input matInput [(ngModel)]="form.full_name" name="full_name" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput [(ngModel)]="form.email" name="email" type="email" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Usuario</mat-label>
            <input matInput [(ngModel)]="form.username" name="username" required />
          </mat-form-field>
          <mat-form-field appearance="outline" *ngIf="!editingId">
            <mat-label>Contraseña</mat-label>
            <input matInput [(ngModel)]="form.password" name="password" type="password" required />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Roles</mat-label>
            <mat-select [(ngModel)]="form.roles" name="roles" multiple required>
              <mat-option *ngFor="let r of roleOptions" [value]="r">{{ r }}</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-checkbox [(ngModel)]="form.is_active" name="is_active">Activo</mat-checkbox>
          <div class="actions">
            <button mat-raised-button color="primary" type="submit">{{ editingId ? 'Guardar' : 'Crear' }}</button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>

        <table mat-table [dataSource]="items" class="mat-elevation-z2">
          <ng-container matColumnDef="full_name">
            <th mat-header-cell *matHeaderCellDef>Nombre</th>
            <td mat-cell *matCellDef="let u">{{ u.full_name }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let u">{{ u.email }}</td>
          </ng-container>
          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef>Usuario</th>
            <td mat-cell *matCellDef="let u">{{ u.username }}</td>
          </ng-container>
          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef>Roles</th>
            <td mat-cell *matCellDef="let u">
              <span class="chip" *ngFor="let r of u.roles">{{ r }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="is_active">
            <th mat-header-cell *matHeaderCellDef>Activo</th>
            <td mat-cell *matCellDef="let u">
              <mat-icon [style.color]="u.is_active ? 'green' : 'red'">
                {{ u.is_active ? 'check_circle' : 'cancel' }}
              </mat-icon>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Acciones</th>
            <td mat-cell *matCellDef="let u">
              <button mat-icon-button (click)="edit(u)"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="remove(u)"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <div *ngIf="loading" class="center"><mat-spinner diameter="32"></mat-spinner></div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .toolbar { margin: 16px 0; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .actions { display: flex; align-items: center; gap: 8px; }
    .chip { background: #e0e7ff; color: #3730a3; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; margin-right: 4px; }
    table { width: 100%; }
    .center { display: flex; justify-content: center; padding: 24px; }
  `,
})
export class UsersComponent implements OnInit {
  items: User[] = [];
  columns = ['full_name', 'email', 'username', 'roles', 'is_active', 'actions'];
  loading = true;
  formVisible = false;
  editingId: string | null = null;
  form: any = { full_name: '', email: '', username: '', password: '', roles: [], is_active: true };
  roleOptions = Object.values(RoleName);

  constructor(private api: ApiService, private toast: Toast) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.api.get<User[]>('/users');
    } catch {
      this.toast.error('No se pudieron cargar los usuarios');
    } finally {
      this.loading = false;
    }
  }

  openCreate(): void {
    this.editingId = null;
    this.form = { full_name: '', email: '', username: '', password: '', roles: [], is_active: true };
    this.formVisible = true;
  }

  edit(u: User): void {
    this.editingId = u.id;
    this.form = { full_name: u.full_name, email: u.email, username: u.username, password: '', roles: [...u.roles], is_active: u.is_active };
    this.formVisible = true;
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
  }

  async save(): Promise<void> {
    try {
      if (this.editingId) {
        const body: any = { full_name: this.form.full_name, email: this.form.email, roles: this.form.roles, is_active: this.form.is_active };
        if (this.form.password) {
          body.password = this.form.password;
        }
        await this.api.patch(`/users/${this.editingId}`, body);
        this.toast.success('Usuario actualizado');
      } else {
        await this.api.post('/users', this.form);
        this.toast.success('Usuario creado');
      }
      this.cancel();
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al guardar');
    }
  }

  async remove(u: User): Promise<void> {
    if (!confirm(`¿Eliminar al usuario ${u.full_name}?`)) {
      return;
    }
    try {
      await this.api.delete(`/users/${u.id}`);
      this.toast.success('Usuario eliminado');
      await this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.detail || 'Error al eliminar');
    }
  }
}
