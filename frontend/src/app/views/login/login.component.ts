import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { Toast } from '../../shared/toast';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <section class="login">
      <aside class="panel" aria-label="Información institucional">
        <div class="panel-brand">
          <div class="panel-logo" aria-hidden="true">
            <mat-icon>qr_code_2</mat-icon>
          </div>
          <div class="panel-title">Sistema de Asistencia Universitaria</div>
        </div>

        <div class="panel-body">
          <h1 class="panel-headline">Cada clase, cada presencia, cada minuto.</h1>
          <p class="panel-text">
            Registro de asistencia por códigos QR dinámicos, verificación por geolocalización y control horario en tiempo real.
          </p>
        </div>

        <div class="panel-foot" aria-hidden="true">
          <span>Registro por QR</span>
          <span class="panel-sep">·</span>
          <span>Geolocalización</span>
          <span class="panel-sep">·</span>
          <span>Control horario</span>
        </div>
      </aside>

      <div class="form-panel">
        <div class="form-card">
          <div class="form-brand hide-desktop" aria-hidden="true">
            <div class="form-logo">
              <mat-icon>qr_code_2</mat-icon>
            </div>
          </div>

          <h2 class="form-title">Ingresar</h2>
          <p class="form-subtitle">Usá tu email o usuario para acceder.</p>

          <form (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Email o usuario</mat-label>
              <input matInput [(ngModel)]="identifier" name="identifier" required autocomplete="username" autofocus />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full">
              <mat-label>Contraseña</mat-label>
              <input matInput [(ngModel)]="password" name="password" [type]="showPassword ? 'text' : 'password'" required autocomplete="current-password" />
              <button
                mat-icon-button
                matSuffix
                type="button"
                class="pw-toggle"
                [attr.aria-label]="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [disabled]="loading"
                (click)="togglePassword()"
              >
                <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            @if (error) {
              <div class="error-box" role="alert">
                <mat-icon aria-hidden="true">error_outline</mat-icon>
                <span>{{ error }}</span>
              </div>
            }

            <button mat-flat-button color="primary" class="full submit-btn" type="submit" [disabled]="loading">
              @if (loading) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <span>Ingresar</span>
              }
            </button>
          </form>

          <div class="forgot">
            <button type="button" class="forgot-link" (click)="onForgotPassword()">¿Olvidaste tu contraseña?</button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    .login {
      min-height: 100vh;
      background: var(--surface-page);
    }

    .panel {
      display: none;
      flex-direction: column;
      justify-content: space-between;
      gap: 48px;
      padding: 48px 56px;
      color: #ffffff;
      background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 55%, #0f172a 100%);
      overflow: hidden;
    }
    .panel-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .panel-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 56px;
      height: 56px;
      border-radius: var(--radius-md);
      background: rgb(255 255 255 / 14%);
      border: 1px solid rgb(255 255 255 / 24%);
    }
    .panel-logo mat-icon {
      width: 32px;
      height: 32px;
      font-size: 32px;
    }
    .panel-title {
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      line-height: 1.35;
    }
    .panel-headline {
      margin: 0 0 16px;
      font-size: clamp(1.75rem, 3.4vw, 2.75rem);
      font-weight: 600;
      line-height: 1.15;
      letter-spacing: -0.02em;
      max-width: 560px;
    }
    .panel-text {
      margin: 0;
      font-size: var(--fs-body);
      line-height: 1.6;
      color: rgb(255 255 255 / 78%);
      max-width: 480px;
    }
    .panel-foot {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      font-size: var(--fs-caption);
      color: rgb(255 255 255 / 62%);
    }
    .panel-sep {
      color: rgb(255 255 255 / 40%);
    }

    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
    }
    .form-card {
      width: 100%;
      max-width: 400px;
      padding: 32px 32px 24px;
      background: var(--surface-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-floating);
    }
    .form-brand {
      display: flex;
      justify-content: center;
      margin-bottom: 20px;
    }
    .form-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: var(--radius-md);
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    .form-logo mat-icon {
      width: 30px;
      height: 30px;
      font-size: 30px;
    }
    .form-title {
      margin: 0 0 4px;
      font-size: var(--fs-title);
      font-weight: 600;
      color: var(--text-primary);
    }
    .form-subtitle {
      margin: 0 0 24px;
      font-size: var(--fs-body);
      color: var(--text-secondary);
    }
    .full {
      width: 100%;
      margin-bottom: 12px;
    }
    .pw-toggle {
      color: var(--text-secondary);
    }
    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0 12px;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      background: var(--color-danger-bg);
      color: var(--color-danger);
      font-size: var(--fs-caption);
    }
    .error-box mat-icon {
      flex: none;
      width: 20px;
      height: 20px;
      font-size: 20px;
    }
    .submit-btn {
      height: 48px;
      margin-top: 4px;
    }
    .forgot {
      display: flex;
      justify-content: center;
      margin-top: 20px;
    }
    .forgot-link {
      border: none;
      background: none;
      padding: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--fs-caption);
      color: var(--color-primary-600);
      text-decoration: none;
    }
    .forgot-link:hover {
      text-decoration: underline;
    }

    @media (min-width: 960px) {
      .login {
        display: grid;
        grid-template-columns: minmax(0, 55%) 1fr;
      }
      .panel {
        display: flex;
      }
    }
  `,
})
export class LoginComponent {
  identifier = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private toast: Toast,
    private cdr: ChangeDetectorRef,
  ) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onForgotPassword(): void {
    this.toast.success('Contactá al administrador del sistema para restablecerla.');
  }

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
      this.cdr.markForCheck();
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
