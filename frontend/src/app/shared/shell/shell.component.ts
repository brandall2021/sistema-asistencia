import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThemeService } from '../../core/services/theme.service';
import { RoleName } from '../../core/models';
import { BreadcrumbsComponent } from '../components/breadcrumbs/breadcrumbs.component';
import { UserAvatarComponent } from '../components/user-avatar/user-avatar.component';

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

interface Breadcrumb {
  label: string;
  route?: string;
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

const BREADCRUMBS: Record<string, string> = {
  home: 'Inicio',
  admin: 'Administración',
  teacher: 'Docencia',
  student: 'Estudiante',
  users: 'Usuarios',
  students: 'Estudiantes',
  teachers: 'Docentes',
  careers: 'Carreras',
  subjects: 'Materias',
  commissions: 'Comisiones',
  enrollments: 'Inscripciones',
  classrooms: 'Aulas',
  schedules: 'Horarios',
  classes: 'Clases',
  reports: 'Reportes',
  audit: 'Auditoría',
  scan: 'Escanear QR',
  history: 'Mi Asistencia',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  DOCENTE: 'Docente',
  ALUMNO: 'Alumno',
  AUDITOR: 'Auditor',
};

const SIDEBAR_KEY = 'sau.sidebar';
const MOBILE_QUERY = '(max-width: 959px)';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    BreadcrumbsComponent,
    UserAvatarComponent,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        class="nav"
        [class.collapsed]="collapsed && !mobile"
        [mode]="mobile ? 'over' : 'side'"
        [opened]="mobile ? mobileOpen : true"
        (openedChange)="onOpenedChange($event)">
        <div class="brand">
          <mat-icon>qr_code_2</mat-icon>
          @if (!collapsed || mobile) {
            <span class="brand-name">Asistencia</span>
          }
        </div>

        <nav class="menu-scroll" aria-label="Menú principal">
          @for (group of menu; track group.label) {
            @if (collapsed && !mobile) {
              <mat-divider class="group-sep" aria-hidden="true"></mat-divider>
            } @else {
              <div class="menu-group">{{ group.label }}</div>
            }
            @for (item of group.items; track item.route) {
              <a
                class="nav-item"
                [routerLink]="item.route"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.route === '/home' }"
                (click)="onNav()"
                [attr.aria-label]="item.label"
                [matTooltip]="collapsed && !mobile ? item.label : ''"
                matTooltipPosition="right">
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                @if (!collapsed || mobile) {
                  <span class="item-label">{{ item.label }}</span>
                }
              </a>
            }
          }
        </nav>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          <button
            mat-icon-button
            (click)="toggleSidebar()"
            [attr.aria-label]="menuButtonLabel">
            <mat-icon>{{ menuIcon }}</mat-icon>
          </button>

          <app-breadcrumbs class="crumbs" [crumbs]="crumbs"></app-breadcrumbs>

          <span class="spacer"></span>

          <button
            mat-icon-button
            (click)="theme.toggle()"
            [attr.aria-label]="dark ? 'Activar modo claro' : 'Activar modo oscuro'">
            <mat-icon>{{ dark ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>

          <button
            mat-icon-button
            aria-label="Notificaciones"
            [matBadge]="unread"
            matBadgeOverlap="false"
            [matBadgeHidden]="unread === 0"
            (click)="notifications.clear()">
            <mat-icon>notifications</mat-icon>
          </button>

          <button
            mat-icon-button
            class="profile-btn"
            [matMenuTriggerFor]="profileMenu"
            aria-label="Menú de perfil">
            <app-user-avatar [name]="userName" [size]="36"></app-user-avatar>
          </button>

          <mat-menu #profileMenu="matMenu" xPosition="before" class="profile-menu">
            <div class="profile-header">
              <div class="profile-name">{{ userName }}</div>
              <div class="profile-roles">{{ rolesText }}</div>
            </div>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="openChangePassword()">
              <mat-icon>key</mat-icon>
              <span>Cambiar contraseña</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Cerrar sesión</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .shell {
      height: 100vh;
    }

    .nav {
      width: 272px;
      background: var(--surface-card);
      border-right: 1px solid var(--border-color);
      transition: width var(--dur-med) var(--ease-out);
    }
    .nav.collapsed {
      width: 76px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 64px;
      padding: 0 20px;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 1.05rem;
      white-space: nowrap;
      overflow: hidden;
      border-bottom: 1px solid var(--border-color);
    }
    .brand mat-icon {
      flex: none;
      color: var(--color-primary-600);
    }
    .nav.collapsed .brand {
      justify-content: center;
      padding: 0;
    }

    .menu-scroll {
      overflow-y: auto;
      padding-block: 8px 16px;
      max-height: calc(100vh - 64px);
    }

    .menu-group {
      padding: 20px 20px 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-tertiary);
    }
    .group-sep {
      margin: 10px 14px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 44px;
      margin: 2px 10px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      text-decoration: none;
      color: var(--text-secondary);
      font-size: var(--fs-body);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .nav-item mat-icon {
      flex: none;
      color: var(--text-tertiary);
      transition: color var(--dur-fast) var(--ease-out);
    }
    .nav-item:hover {
      background: var(--surface-muted);
      color: var(--text-primary);
    }
    .nav-item.active {
      background: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
      color: var(--color-primary-600);
      font-weight: 500;
    }
    .nav-item.active mat-icon {
      color: var(--color-primary-600);
    }
    .item-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nav.collapsed .nav-item {
      justify-content: center;
      padding: 0;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 4px;
      height: auto;
      min-height: 64px;
      padding: 8px 16px;
      background: var(--surface-card);
      border-bottom: 1px solid var(--border-color);
      box-shadow: none;
    }
    .crumbs {
      min-width: 0;
      margin-inline: 8px;
    }
    .profile-btn {
      margin-inline-start: 4px;
    }

    .content {
      padding: var(--page-padding);
    }

    .profile-header {
      padding: 12px 16px;
      min-width: 200px;
    }
    .profile-name {
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .profile-roles {
      margin-top: 2px;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }

    @media (max-width: 959px) {
      .content {
        padding: 16px;
      }
    }
    @media (max-width: 599px) {
      .topbar {
        padding-inline: 8px;
      }
      .crumbs {
        display: none;
      }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  menu: MenuGroup[] = [];
  crumbs: Breadcrumb[] = [];
  unread = 0;
  dark = false;
  collapsed = false;
  mobile = false;
  mobileOpen = false;
  userName = '';
  rolesText = '';

  private subs = new Subscription();

  constructor(
    private auth: AuthService,
    private bp: BreakpointObserver,
    readonly notifications: NotificationService,
    readonly theme: ThemeService,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const pref = localStorage.getItem(SIDEBAR_KEY);
    this.collapsed = pref === 'collapsed';

    const user = this.auth.getUser();
    this.userName = user?.full_name ?? '';
    this.rolesText = (user?.roles ?? []).map((r: string) => ROLE_LABELS[r] ?? r).join(' · ');

    this.menu = MENU.map((g) => ({
      ...g,
      items: g.items.filter((m) => this.auth.hasAnyRole(...m.roles)),
    })).filter((g) => g.items.length > 0);

    this.notifications.start();
    this.subs.add(this.notifications.unread$.subscribe((n) => {
      this.unread = n;
      this.cdr.markForCheck();
    }));
    this.subs.add(this.theme.isDark$.subscribe((d) => {
      this.dark = d;
      this.cdr.markForCheck();
    }));
    this.subs.add(
      this.bp.observe([MOBILE_QUERY]).subscribe((state) => {
        this.mobile = state.matches;
        if (this.mobile) {
          this.mobileOpen = false;
        }
        this.cdr.markForCheck();
      }),
    );
    this.subs.add(
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        this.crumbs = this.buildCrumbs();
        if (this.mobile) {
          this.mobileOpen = false;
        }
        this.cdr.markForCheck();
      }),
    );
    this.crumbs = this.buildCrumbs();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get menuIcon(): string {
    if (this.mobile) {
      return 'menu';
    }
    return this.collapsed ? 'menu' : 'menu_open';
  }

  get menuButtonLabel(): string {
    if (this.mobile) {
      return 'Abrir menú';
    }
    return this.collapsed ? 'Expandir menú' : 'Contraer menú';
  }

  toggleSidebar(): void {
    if (this.mobile) {
      this.mobileOpen = !this.mobileOpen;
      return;
    }
    this.collapsed = !this.collapsed;
    localStorage.setItem(SIDEBAR_KEY, this.collapsed ? 'collapsed' : 'expanded');
  }

  onOpenedChange(opened: boolean): void {
    if (this.mobile) {
      this.mobileOpen = opened;
    }
  }

  onNav(): void {
    if (this.mobile) {
      this.mobileOpen = false;
    }
  }

  openChangePassword(): void {
    void import('./change-password.component').then((m) => {
      this.dialog.open(m.ChangePasswordComponent, {
        width: '420px',
        maxWidth: '92vw',
      });
    });
  }

  logout(): void {
    this.auth.logout();
  }

  private buildCrumbs(): Breadcrumb[] {
    const segments = this.router.url.split('/').filter(Boolean);
    const recognized = segments.filter((s) => BREADCRUMBS[s]);
    let found = 0;
    const crumbs: Breadcrumb[] = [];
    for (let i = 0; i < segments.length; i++) {
      const title = BREADCRUMBS[segments[i]];
      if (!title) {
        continue;
      }
      found++;
      const path = '/' + segments.slice(0, i + 1).join('/');
      const isLast = found === recognized.length;
      crumbs.push({
        label: title,
        route: !isLast && this.pathExists(path.split('/').filter(Boolean), this.router.config) ? path : undefined,
      });
    }
    return crumbs;
  }

  private pathExists(segments: string[], routes: { path?: string; children?: unknown[] }[]): boolean {
    if (segments.length === 0) {
      return true;
    }
    for (const route of routes) {
      if (!route.path) {
        continue;
      }
      const routeSegs = route.path.split('/').filter(Boolean);
      if (routeSegs.length > segments.length) {
        continue;
      }
      const matches = routeSegs.every((rs, j) => rs === segments[j] || rs.startsWith(':'));
      if (!matches) {
        continue;
      }
      const rest = segments.slice(routeSegs.length);
      if (rest.length === 0) {
        return true;
      }
      if (route.children && this.pathExists(rest, route.children as { path?: string; children?: unknown[] }[])) {
        return true;
      }
    }
    return false;
  }
}
