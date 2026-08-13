import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginResponse, RoleName } from '../../core/models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-wrap">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Sistema de Asistencia</mat-card-title>
          <mat-card-subtitle>QR dinámico · Geolocalización GPS · Control horario</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email o usuario</mat-label>
              <input matInput [(ngModel)]="identifier" name="identifier" required autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>Contraseña</mat-label>
              <input matInput [(ngModel)]="password" name="password" type="password" required autocomplete="current-password" />
            </mat-form-field>
            <mat-error *ngIf="error">{{ error }}</mat-error>
            <button mat-flat-button color="primary" class="full" type="submit" [disabled]="loading">
              <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
              <span *ngIf="!loading">Ingresar</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-wrap {
      height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #1e293b, #312e81);
    }
    .login-card { width: 380px; padding: 16px; }
    .full { width: 100%; margin-bottom: 12px; }
    mat-card-title { font-weight: 600; }
    .mdc-button { height: 44px; }
  `,
})
export class LoginComponent {
  identifier = '';
  password = '';
  error = '';
  loading = false;

  constructor(private api: ApiService, private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    if (this.loading) {
      return;
    }
    this.error = '';
    this.loading = true;
    try {
      const resp = await this.api.post<LoginResponse>('/auth/login', {
        identifier: this.identifier,
        password: this.password,
      });
      this.auth.setTokens(resp.access_token, resp.refresh_token);
      this.auth.setUser(resp.user);
      this.redirect(resp.user.roles);
    } catch (e: any) {
      this.error = e?.error?.detail || 'Credenciales inválidas';
    } finally {
      this.loading = false;
    }
  }

  private redirect(roles: RoleName[]): void {
    if (roles.includes(RoleName.ALUMNO) && !roles.includes(RoleName.ADMIN)) {
      this.router.navigate(['/student/scan']);
    } else if (roles.includes(RoleName.DOCENTE) && !roles.includes(RoleName.ADMIN)) {
      this.router.navigate(['/teacher/classes']);
    } else if (roles.includes(RoleName.AUDITOR) && !roles.includes(RoleName.ADMIN)) {
      this.router.navigate(['/admin/reports']);
    } else {
      this.router.navigate(['/admin/users']);
    }
  }
}
