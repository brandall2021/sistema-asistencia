import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { RoleName } from '../../core/models';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles: RoleName[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const MENU: MenuGroup[] = [
  {
    label: 'Inicio',
    items: [
      { label: 'Inicio', icon: 'home', route: '/home', roles: [RoleName.ADMIN, RoleName.DOCENTE, RoleName.ALUMNO, RoleName.AUDITOR] },
    ],
  },
  {
    label: 'Personas',
    items: [
      { label: 'Usuarios', icon: 'group', route: '/admin/users', roles: [RoleName.ADMIN] },
      { label: 'Estudiantes', icon: 'school', route: '/admin/students', roles: [RoleName.ADMIN] },
      { label: 'Docentes', icon: 'co_present', route: '/admin/teachers', roles: [RoleName.ADMIN] },
    ],
  },
  {
    label: 'Académico',
    items: [
      { label: 'Carreras', icon: 'account_balance', route: '/admin/careers', roles: [RoleName.ADMIN] },
      { label: 'Materias', icon: 'menu_book', route: '/admin/subjects', roles: [RoleName.ADMIN] },
      { label: 'Comisiones', icon: 'groups', route: '/admin/commissions', roles: [RoleName.ADMIN] },
      { label: 'Inscripciones', icon: 'how_to_reg', route: '/admin/enrollments', roles: [RoleName.ADMIN] },
    ],
  },
  {
    label: 'Asistencia',
    items: [
      { label: 'Aulas', icon: 'meeting_room', route: '/admin/classrooms', roles: [RoleName.ADMIN] },
      { label: 'Horarios', icon: 'schedule', route: '/admin/schedules', roles: [RoleName.ADMIN] },
      { label: 'Clases', icon: 'class', route: '/admin/classes', roles: [RoleName.ADMIN] },
      { label: 'Mis Clases', icon: 'class', route: '/teacher/classes', roles: [RoleName.DOCENTE] },
      { label: 'Reportes', icon: 'assessment', route: '/admin/reports', roles: [RoleName.ADMIN, RoleName.AUDITOR] },
      { label: 'Escanear QR', icon: 'qr_code_scanner', route: '/student/scan', roles: [RoleName.ALUMNO] },
      { label: 'Mi Asistencia', icon: 'fact_check', route: '/student/history', roles: [RoleName.ALUMNO] },
    ],
  },
  {
    label: 'Administración',
    items: [
      { label: 'Auditoría', icon: 'fact_check', route: '/admin/audit', roles: [RoleName.ADMIN] },
    ],
  },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #snav [mode]="mode" [opened]="opened" class="nav">
        <div class="brand">
          <mat-icon>qr_code_2</mat-icon>
          <span>{{ appName }}</span>
        </div>
        <mat-nav-list>
          <ng-container *ngFor="let group of menu">
            <div class="menu-group">{{ group.label }}</div>
            <a mat-list-item
               *ngFor="let item of group.items"
               [routerLink]="item.route"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: item.route === '/home' }"
               (click)="onNav()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          </ng-container>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar color="primary" class="topbar">
          <button mat-icon-button (click)="snav.toggle()" aria-label="Menú">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="user">{{ userLabel }}</span>
          <span class="spacer"></span>
          <button mat-icon-button (click)="logout()" aria-label="Salir">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .shell { height: 100vh; }
    .nav { width: 260px; background: #1e293b; color: #fff; }
    .nav .mat-mdc-list-item { color: #cbd5e1; }
    .nav .mat-mdc-list-item.active { background: rgba(99, 102, 241, 0.25); color: #fff; }
    .brand {
      display: flex; align-items: center; gap: 8px; padding: 16px;
      font-weight: 600; font-size: 1.05rem; color: #fff;
    }
    .menu-group {
      padding: 16px 16px 4px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
    }
    .topbar { position: sticky; top: 0; z-index: 10; }
    .spacer { flex: 1 1 auto; }
    .user { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .content { padding: 16px; max-width: 1200px; margin: 0 auto; }
    @media (min-width: 901px) {
      .topbar .mat-icon-button:first-child { display: none; }
      .content { padding: 24px; }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  appName = 'Asistencia Universitaria';
  menu: MenuGroup[] = MENU.map((g) => ({
    ...g,
    items: g.items.filter((m) => this.auth.hasAnyRole(...m.roles)),
  })).filter((g) => g.items.length > 0);
  mode: 'side' | 'over' = 'side';
  opened = true;
  private mobile = false;

  constructor(
    private auth: AuthService,
    private bp: BreakpointObserver,
    private notifications: NotificationService,
  ) {}

  ngOnInit(): void {
    this.notifications.start();
    this.bp.observe(['(max-width: 900px)']).subscribe((state) => {
      this.mobile = state.matches;
      this.mode = this.mobile ? 'over' : 'side';
      this.opened = !this.mobile;
    });
  }

  ngOnDestroy(): void {
    /* el observer se limpia solo con providedIn root */
  }

  get userLabel(): string {
    const u = this.auth.getUser();
    return u ? `${u.full_name} (${(u.roles ?? []).join(', ')})` : '';
  }

  onNav(): void {
    if (this.mobile) {
      this.opened = false;
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
