# Rediseño Visual del Sistema de Asistencia Universitaria

> **Para agentes de ejecución:** implementar tarea por tarea con subagentes; verificar cada tarea con `ng build --configuration production` y/o servidor dev antes de pasarla a la siguiente. Pasos usan checkboxes (`- [ ]`).

**Goal:** Modernizar la interfaz Angular 21 del sistema de asistencia (roles ADMIN/DOCENTE/ALUMNO/AUDITOR) sin cambiar rutas, roles, endpoints ni reglas de negocio, manteniendo Angular Material, PWA, QR, GPS y WebSocket.

**Architecture:** Sistema de tokens CSS centralizado + tema Material 3 claro/oscuro + layout nuevo (sidebar colapsable + topbar) + componentes reutilizables (page-header, kpi-card, status-chip, empty/error/skeleton, confirm-dialog, filter-bar, responsive-table, user-avatar, breadcrumbs, simple-chart, form-dialog/form-drawer) + refactor por vista. Gráficos en SVG puro (sin dependencias nuevas; el presupuesto del bundle es 2.5 MB máx). Dashboards y reportes se alimentan **solo** de endpoints existentes.

**Tech Stack:** Angular 21, Angular Material 3, SCSS, TypeScript 5.9. Sin dependencias nuevas.

**Rama:** `redesign/ui` (creada). Base: `main` en `d37332b`.

## Global Constraints

- NO modificar el backend salvo necesidad justificada y documentada. Los endpoints usados: `/auth/*`, `/dashboard/summary`, `/reports/attendance`, `/reports/students/low-attendance`, `/reports/attendance/export`, `/classes`, `/classes/{id}`, `/classes/{id}/attendance`, `/classes/{id}/start|finish|qr`, `/attendance/me`, `/attendance/check-in`, `/audit`, y los CRUD `/users`, `/students`, `/teachers`, `/careers`, `/subjects`, `/commissions`, `/enrollments`, `/classrooms`, `/schedules`.
- No inventar información: los valores del dashboard salen de `/dashboard/summary`, `/reports/attendance` (dimensiones `student|commission|subject|career` + `commission_id|career_id|from_date|to_date`) y `/attendance/me`.
- `ReportDep` = ADMIN/AUDITOR/DOCENTE. ALUMNO NO puede usar `/reports/*`; el dashboard del alumno se computa desde `/attendance/me`.
- Estados internos SIEMPRE traducidos al usuario (ver maps en Task 2). Nunca mostrar `PRESENT`, `SCHEDULED`, etc.
- Todas las rutas existentes (ver `src/app/app.routes.ts`) se conservan.
- Todos los `window.confirm()` se reemplazan por `ConfirmDialog`.
- Sin dependencias npm nuevas (cero). Gráficos en SVG.
- Accesibilidad WCAG 2.1 AA: focus visible, aria-live en escáner, tablas con `th`, diálogos con foco atrapado (MatDialog ya lo hace), `prefers-reduced-motion`.
- `prettier` del repo aplica a TS/HTML (`.prettierrc`); respetar estilo: componentes standalone con template/styles inline.
- No hay infraestructura de tests frontend en el repo (no hay target `test` en `angular.json`, sin karma/jasmine). La verificación de cada tarea es: compila `ng build --configuration production` y revisión visual en el dev server (`ng serve`). No se agrega framework de tests sin pedido explícito.
- Commits frecuentes en español, estilo del repo (p.ej. `feat: ...`, `Fix: ...`).
- Estados internos con color SEMPRE acompañados de texto (no solo color).

---

## Etapa 1 — Fundación visual

### Task 1: Sistema de tokens, tema Material y estilos globales

**Files:**
- Create: `frontend/src/styles/_tokens.scss`
- Create: `frontend/src/styles/_material-theme.scss`
- Create: `frontend/src/styles/_layout.scss`
- Create: `frontend/src/styles/_utilities.scss`
- Modify: `frontend/src/styles.scss` (reescribir)
- Modify: `frontend/src/index.html`

**Interfaces:**
- Produce: CSS variables `--color-primary-*`, `--color-success(-bg)`, `--color-warning(-bg)`, `--color-danger(-bg)`, `--color-info(-bg)`, `--surface-page`, `--surface-card`, `--surface-muted`, `--text-primary`, `--text-secondary`, `--border-color`, `--radius-*`, `--shadow-*`, `--page-max-width`, `--page-padding`, más `--ease-out`, `--ease-in-out`, `--dur-fast/med/slow`, y la jerarquía tipográfica `--fs-title`, `--fs-subtitle`, `--fs-card-title`, `--fs-kpi`, `--fs-body`, `--fs-caption`. Modo oscuro bajo `[data-theme='dark']`.

- [ ] **Step 1: `_tokens.scss`** — Definir `:root` con los tokens del spec (colores, superficies, radios, sombras, tipografía, motion, breakpoints `$mobile:599px; $tablet:959px; $desktop:1280px;`) y `[data-theme='dark']` sobreescribiendo superficies/texto/borde/colores atenuados. No traducir nada: solo valores.

```scss
@use 'sass:map';

$breakpoints: (mobile: 599px, tablet: 959px, desktop: 1280px);

:root {
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-500: #4f46e5;
  --color-primary-600: #4338ca;
  --color-primary-700: #3730a3;

  --color-success: #15803d;
  --color-success-bg: #dcfce7;
  --color-warning: #a16207;
  --color-warning-bg: #fef9c3;
  --color-danger: #b91c1c;
  --color-danger-bg: #fee2e2;
  --color-info: #0369a1;
  --color-info-bg: #e0f2fe;

  --surface-page: #f6f7fb;
  --surface-card: #ffffff;
  --surface-muted: #f8fafc;
  --surface-elevated: #ffffff;

  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --border-color: #e2e8f0;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-card: 0 1px 3px rgb(15 23 42 / 8%);
  --shadow-hover: 0 4px 12px rgb(15 23 42 / 10%);
  --shadow-floating: 0 12px 32px rgb(15 23 42 / 14%);

  --page-max-width: 1440px;
  --page-padding: 24px;

  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --dur-fast: 140ms;
  --dur-med: 220ms;
  --dur-slow: 320ms;

  --fs-title: clamp(1.5rem, 2vw, 2rem);
  --fs-subtitle: 0.9375rem;
  --fs-card-title: 1.0625rem;
  --fs-kpi: clamp(1.75rem, 3vw, 2.25rem);
  --fs-body: 0.9375rem;
  --fs-caption: 0.8125rem;
}

[data-theme='dark'] {
  --surface-page: #0f1117;
  --surface-card: #171a21;
  --surface-muted: #1d212b;
  --surface-elevated: #212734;
  --text-primary: #e6e8ee;
  --text-secondary: #a6adbb;
  --text-tertiary: #7d8594;
  --border-color: #2b3240;
  --shadow-card: 0 1px 3px rgb(0 0 0 / 40%);
  --shadow-hover: 0 4px 14px rgb(0 0 0 / 45%);
  --shadow-floating: 0 12px 32px rgb(0 0 0 / 55%);
  --color-success: #4ade80;
  --color-success-bg: rgb(34 197 94 / 14%);
  --color-warning: #fbbf24;
  --color-warning-bg: rgb(251 191 36 / 14%);
  --color-danger: #f87171;
  --color-danger-bg: rgb(248 113 113 / 14%);
  --color-info: #38bdf8;
  --color-info-bg: rgb(56 189 248 / 14%);
}
```

- [ ] **Step 2: `_material-theme.scss`** — Tema Material 3 con paleta propia (indigo) para claro y oscuro. Aplicar `mat.theme()` en `html` (claro por defecto) y re-aplicarlo en `[data-theme='dark']`. Incluir `mat.typography-hierarchy()` y `mat.all-component-themes` no es necesario (mat.theme lo cubre). Mapear también las superficies del sistema a nuestros tokens vía `--mat-sys-surface` en `:root`/`[data-theme='dark']`.

```scss
@use '@angular/material' as mat;

$brand: (
  0: #000000, 10: #1b1b3a, 20: #312e81, 25: #3b3796, 30: #4338ca, 35: #5147d8,
  40: #4f46e5, 50: #6d63f0, 60: #8b84f6, 70: #a9a4fb, 80: #c7c3fd, 90: #e4e1ff,
  95: #f1efff, 98: #faf9ff, 99: #fefbff, 100: #ffffff,
);

$accent: (
  0: #000000, 10: #04303f, 20: #065c74, 25: #07698a, 30: #0369a1, 40: #0284c7,
  50: #38bdf8, 60: #7dd3fc, 70: #bae6fd, 80: #dbeafe, 90: #eff6ff, 95: #f5faff,
  98: #fbfeff, 99: #feffff, 100: #ffffff,
);

html {
  @include mat.theme((
    color: (theme-type: light, primary: $brand, tertiary: $accent),
    typography: Roboto,
    density: 0,
  ));
  color-scheme: light;
  --mat-sys-surface: var(--surface-page);
  --mat-sys-surface-container-low: var(--surface-card);
  --mat-sys-surface-container: var(--surface-card);
  --mat-sys-on-surface: var(--text-primary);
  --mat-sys-on-surface-variant: var(--text-secondary);
  --mat-sys-outline-variant: var(--border-color);
}

[data-theme='dark'] {
  @include mat.theme((
    color: (theme-type: dark, primary: $brand, tertiary: $accent),
    typography: Roboto,
    density: 0,
  ));
  color-scheme: dark;
  --mat-sys-surface: var(--surface-page);
  --mat-sys-surface-container-low: var(--surface-card);
  --mat-sys-surface-container: var(--surface-card);
  --mat-sys-on-surface: var(--text-primary);
  --mat-sys-on-surface-variant: var(--text-secondary);
  --mat-sys-outline-variant: var(--border-color);
}
```

- [ ] **Step 3: `_layout.scss`** — Clases de layout globales: `.page` (contenedor con `--page-max-width`, padding), `.page-head`, `.page-title`, `.page-subtitle`, `.grid-cards`, `.card`, `.card-pad`, `.toolbar-row`, `.kpi-row`, `.two-col`, `.full` (ancho completo en móvil), `.skeleton` (fondo shimmer), `.focus-ring` y reglas `:focus-visible` globales, `@media (prefers-reduced-motion: reduce)` anulando animaciones de movimiento.

- [ ] **Step 4: `_utilities.scss`** — Clases utilitarias: `.text-secondary`, `.text-success`, `.text-danger`, `.text-warning`, `.text-info`, `.text-center`, `.spacer`, `.mt-*/.mb-*`, `.hide-mobile`, `.hide-tablet`, `.hide-desktop`, `.w-100`, `.status-dot`, `.muted`, `.ellipsis`, `.nowrap`, `.clickable`, `.chip` (base neutral). Breakpoints: `@media (max-width: map.get($breakpoints, mobile))`.

- [ ] **Step 5: reescribir `styles.scss`** — Importar en orden `_material-theme`, `_tokens`, `_layout`, `_utilities`. `body` usa `font-family: Roboto, system-ui, ...` y `background: var(--surface-page); color: var(--text-primary);`.

- [ ] **Step 6: `index.html`** — Actualizar `theme-color` a `#4f46e5`, agregar `<meta name="color-scheme" content="light dark">`, mantener Roboto y Material Icons.

- [ ] **Step 7: Verificar compilación**

Run: `cd frontend && npx ng build --configuration production`
Expected: `Application bundle generation complete` (o éxito), sin errores de SCSS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/styles frontend/src/styles.scss frontend/src/index.html
git commit -m "feat: sistema de tokens, tema Material 3 y estilos globales"
```

### Task 2: ThemeService + mapas de estados en español

**Files:**
- Create: `frontend/src/app/core/services/theme.service.ts`
- Modify: `frontend/src/app/shared/status.ts`

**Interfaces:**
- `ThemeService` (providedIn root): `readonly isDark$: BehaviorSubject<boolean>`, `isDark: boolean`, `init(): void` (lee `localStorage['sau.theme']` o `prefers-color-scheme`, aplica `data-theme`), `toggle(): void`, `setDark(v: boolean): void`.
- `STATUS_LABELS: Record<string, string>` — ACTIVE→Activa, INACTIVE→Inactiva, SCHEDULED→Programada, ACTIVE_CLASS→En curso (clave `'ACTIVE_CLASS'`), FINISHED→Finalizada, CANCELLED→Cancelada, PRESENT→Presente, LATE→Tarde, ABSENT→Ausente, JUSTIFIED→Justificada, PENDING→Pendiente, REJECTED→Rechazada, REVIEW→En revisión, APPROVED→Aprobada. Nota: `ACTIVE` es ambiguo (clase vs inscripción); el StatusChip recibirá un parámetro opcional `kind` (ver Task 3) para desambiguar a `Activa`/`En curso`.
- `STATUS_TONES: Record<string, 'success'|'warning'|'danger'|'info'|'neutral'|'primary'>` — PRESENT/APPROVED/ACTIVE→success; LATE/PENDING/REVIEW/INACTIVE→warning; ABSENT/REJECTED/CANCELLED→danger; SCHEDULED/ACTIVE_CLASS→primary; JUSTIFIED→info; FINISHED→neutral.
- `ROLE_LABELS: Record<RoleName, string>` — ADMIN→Administrador, DOCENTE→Docente, ALUMNO→Alumno, AUDITOR→Auditor.
- Mantener `statusClass(status: string): string` (compatibilidad) delegando en `STATUS_TONES`.

- [ ] **Step 1: crear `theme.service.ts`**

```ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const KEY = 'sau.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private dark$ = new BehaviorSubject<boolean>(false);
  readonly isDark$ = this.dark$.asObservable();

  constructor() {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark') this.dark$.next(true);
    else if (stored === 'light') this.dark$.next(false);
    else this.dark$.next(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    this.apply();
  }

  get isDark(): boolean { return this.dark$.value; }

  toggle(): void { this.setDark(!this.isDark); }

  setDark(v: boolean): void {
    this.dark$.next(v);
    localStorage.setItem(KEY, v ? 'dark' : 'light');
    this.apply();
  }

  private apply(): void {
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }
}
```

- [ ] **Step 2: reescribir `status.ts`** con `STATUS_LABELS`, `STATUS_TONES`, `ROLE_LABELS`, `statusClass` y un helper `statusLabel(status, kind?)`:

```ts
import { RoleName } from '../core/models';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  ACTIVE_CLASS: 'En curso',
  INACTIVE: 'Inactiva',
  SCHEDULED: 'Programada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  PRESENT: 'Presente',
  LATE: 'Tarde',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
  REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
};

export const STATUS_TONES: Record<string, StatusTone> = {
  PRESENT: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  ACTIVE_CLASS: 'success',
  LATE: 'warning',
  PENDING: 'warning',
  INACTIVE: 'warning',
  ABSENT: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  SCHEDULED: 'primary',
  JUSTIFIED: 'info',
  REVIEW: 'warning',
  FINISHED: 'neutral',
};

export const ROLE_LABELS: Record<RoleName, string> = {
  [RoleName.ADMIN]: 'Administrador',
  [RoleName.DOCENTE]: 'Docente',
  [RoleName.ALUMNO]: 'Alumno',
  [RoleName.AUDITOR]: 'Auditor',
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status ?? ''] ?? 'neutral';
}

export function statusLabel(status: string, kind?: 'class'): string {
  const key = kind === 'class' && status === 'ACTIVE' ? 'ACTIVE_CLASS' : (status ?? '');
  return STATUS_LABELS[key] ?? status;
}

export function statusClass(status: string): string {
  return statusTone(status);
}
```

- [ ] **Step 3: Verificar compilación** — `npx ng build --configuration production`.
- [ ] **Step 4: Commit** — `git add frontend/src/app/core/services/theme.service.ts frontend/src/app/shared/status.ts && git commit -m "feat: theme service y mapas de estados en español"`.

### Task 3: Componentes compartidos — presentación

**Files:**
- Create: `frontend/src/app/shared/components/page-header/page-header.component.ts`
- Create: `frontend/src/app/shared/components/status-chip/status-chip.component.ts`
- Create: `frontend/src/app/shared/components/user-avatar/user-avatar.component.ts`
- Create: `frontend/src/app/shared/components/empty-state/empty-state.component.ts`
- Create: `frontend/src/app/shared/components/error-state/error-state.component.ts`
- Create: `frontend/src/app/shared/components/loading-skeleton/loading-skeleton.component.ts`
- Create: `frontend/src/app/shared/components/kpi-card/kpi-card.component.ts`

**Interfaces (contrato exacto para las Tasks posteriores):**

- `PageHeaderComponent`:
  - `@Input() title = ''`
  - `@Input() subtitle = ''`
  - `@Input() icon = ''` (nombre de Material Icon; si viene, se muestra en un avatar cuadrado con tinte primario)
  - `@Input() breadcrumbs: { label: string; route?: string }[] = []`
  - `@Input() primaryAction?: PageAction`
  - `@Input() secondaryActions: PageAction[] = []`
  - `@Output() primaryClick = new EventEmitter<void>()`
  - `@Output() actionClick = new EventEmitter<PageAction>()`
  - `export interface PageAction { label: string; icon?: string; type?: 'flat' | 'raised' | 'stroked' | 'basic'; color?: 'primary' | 'accent' | 'warn' | ''; disabled?: boolean; loading?: boolean }`
  - Template: `<app-breadcrumbs>` (si hay), luego fila título/subtitulo/icono a la izquierda y `[primaryAction]`/`secondaryActions` a la derecha. En móvil apilan.

- `StatusChipComponent`:
  - `@Input() status = ''`
  - `@Input() kind?: 'class'` (desambigua ACTIVE)
  - `@Input() label?: string` (override)
  - Render: `<span class="status-chip tone-{{tone}}" [attr.aria-label]="label">` con un punto `.status-dot` de color + texto. Usa `statusTone`/`statusLabel`.

- `UserAvatarComponent`:
  - `@Input() name = ''`
  - `@Input() size = 36`
  - Render: círculo con iniciales (2 letras) y color determinístico derivado del hash del nombre. `aria-hidden="true"` (el nombre ya está en el DOM contiguo).

- `EmptyStateComponent`:
  - `@Input() icon = 'inbox'`
  - `@Input() title = 'Sin resultados'`
  - `@Input() message = ''`
  - `@Input() actionLabel = ''`
  - `@Output() action = new EventEmitter<void>()`
  - Render centrado, icono grande atenuado, título, mensaje, botón opcional.

- `ErrorStateComponent`:
  - `@Input() message = 'Ocurrió un error al cargar los datos.'`
  - `@Input() retryLabel = 'Reintentar'`
  - `@Output() retry = new EventEmitter<void>()`
  - Render con `role="alert"`, icono `error_outline`, mensaje y botón Reintentar.

- `LoadingSkeletonComponent`:
  - `@Input() variant: 'card' | 'list' | 'table' = 'card'`
  - `@Input() rows = 3`
  - Render líneas `.skeleton` con shimmer; `aria-hidden="true"` + contenedor `role="status"` `aria-label="Cargando"`.

- `KpiCardComponent`:
  - `@Input() label = ''`
  - `@Input() value: string | number | null = null`
  - `@Input() icon = ''`
  - `@Input() color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'primary'`
  - `@Input() trend: number | null = null`
  - `@Input() trendLabel = ''` (ej. "vs. ayer")
  - `@Input() loading = false`
  - `@Input() route = ''`
  - Render: `<a class="kpi-card tone-{{color}}" [routerLink]="route || null">` (o `<div>` sin route). Icono en caja tintada, label, valor grande (o skeleton), trend con flecha ↑/↓ y texto (índice de la variación, verde/rojo según signo — acompañado de texto `trendLabel`). `loading=true` → skeleton.

- [ ] **Step 1:** crear los 7 componentes con `standalone: true`, `ChangeDetectionStrategy.OnPush`, imports mínimos (CommonModule, RouterModule cuando aplique, MatIconModule, MatButtonModule).
- [ ] **Step 2:** verificar compilación `npx ng build --configuration production`.
- [ ] **Step 3:** smoke test en dev server: insertar temporalmente `app-status-chip`/`app-kpi-card` en `home.component.ts` (ver `value="ACTIVE" kind="class"` → "En curso") y confirmar visualmente. Revertir después.
- [ ] **Step 4:** Commit — `git add frontend/src/app/shared/components && git commit -m "feat: componentes compartidos de presentación"`.

### Task 4: Componentes compartidos — interacción

**Files:**
- Create: `frontend/src/app/shared/components/breadcrumbs/breadcrumbs.component.ts`
- Create: `frontend/src/app/shared/components/filter-bar/filter-bar.component.ts`
- Create: `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
- Create: `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.service.ts`
- Create: `frontend/src/app/shared/components/responsive-table/responsive-table.component.ts`
- Create: `frontend/src/app/shared/components/simple-chart/simple-chart.component.ts`
- Create: `frontend/src/app/shared/forms/form-fields.ts`
- Create: `frontend/src/app/shared/forms/form-dialog.component.ts`
- Create: `frontend/src/app/shared/forms/form-drawer.component.ts`
- Create: `frontend/src/app/shared/forms/forms.service.ts`

**Interfaces (contrato exacto):**

- `BreadcrumbsComponent`:
  - `@Input() crumbs: { label: string; route?: string }[] = []`
  - Último crumb = actual (texto, no link). Anteriores = links. `aria-label="Migas de pan"`.

- `FilterBarComponent`:
  - `@Input() searchPlaceholder = 'Buscar…'`
  - `@Input() searchValue = ''` (two-way: `@Input` + `@Output() searchValueChange`)
  - `@Input() resultCount = 0`
  - `@Input() activeFilters = 0` (conteo de filtros activos)
  - `@Input() primaryAction?: PageAction` (reutiliza `PageAction` de page-header)
  - `@Output() primaryClick = new EventEmitter<void>()`
  - `@Output() clearFilters = new EventEmitter<void>()`
  - Template: fila 1 = buscador (con icono `search` y botón limpiar búsqueda), `ng-content` para selects de filtro, botón "Limpiar" (solo si `activeFilters>0` o hay búsqueda), texto "N resultados", botón primario a la derecha. En móvil apila y el botón primario ocupa todo el ancho.
  - `@Output() search = new EventEmitter<string>()` en `(input)` debounced 300 ms (implementar con `Subject` + `debounceTime`).

- `ConfirmDialogComponent` (data de entrada):
  - `export interface ConfirmData { title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; confirmIcon?: string }`
  - Template: título con icono (alerta si destructivo), mensaje con **consecuencia** en texto claro, botón Cancelar (`mat-button`) y Confirmar (`mat-flat-button` `color="warn"` si destructivo, `color="primary"` si no). Botón confirmar deshabilitado mientras `submitting` (inyectado desde el panel). `(confirmar)` → `dialogRef.close(true)`.
- `ConfirmDialogService`:
  - `openConfirm(data: ConfirmData): Observable<boolean>` usando `MatDialog.open(ConfirmDialogComponent, { data, width: '420px', maxWidth: '92vw' })` con `autoFocus` en cancelar para acciones destructivas (evita borrado accidental con Enter).
- `ResponsiveTableComponent`:
  - `export interface TableColumn { key: string; header: string; accessor?: (row: unknown) => string; template?: TemplateRef<unknown>; sortable?: boolean; mobilePrimary?: boolean; mobileSecondary?: boolean; width?: string }`
  - `@Input() columns: TableColumn[] = []`
  - `@Input() data: unknown[] = []`
  - `@Input() loading = false`
  - `@Input() trackKey = 'id'`
  - `@Input() emptyTitle = 'Sin resultados'`
  - `@Input() emptyMessage = 'No se encontraron elementos para los filtros aplicados.'`
  - `@Input() actionsTemplate?: TemplateRef<unknown>` (columna de acciones extra al final)
  - `@Input() pageSize = 10`
  - `@Input() sortEnabled = true`
  - Desktop (>=768px): `mat-table` con header fijo (`position: sticky`), `matSort` cliente (ordena por `accessor`/`key`), filas con hover, `mat-paginator` (cliente). Si `loading` → filas skeleton. Si data vacía → `<app-empty-state>` dentro de la tabla.
  - Mobile (<768px): tarjetas (una por fila): campo `mobilePrimary` grande, campos `mobileSecondary` como líneas secundarias, resto opcional; `actionsTemplate` al pie de la tarjeta. Paginación simple "Mostrando X–Y de Z · Anterior/Siguiente". Se detecta con `BreakpointObserver` (`(max-width: 767px)`).
  - Exportable para el resto de la app: las Tasks de listados lo usarán.

- `SimpleChartComponent`:
  - `export interface ChartDatum { label: string; value: number; color?: string }`
  - `@Input() type: 'bars' | 'line' | 'donut' = 'bars'`
  - `@Input() data: ChartDatum[] = []`
  - `@Input() height = 220`
  - `@Input() stacked = false` (para barras apiladas presentes/tarde/ausente)
  - `@Input() ariaLabel = 'Gráfico'`
  - SVG puro: `bars` = rects con valores como `<title>`; `line` = polyline + área con gradiente; `donut` = círculos stroke-dasharray segmentados con leyenda debajo (con colores + texto, nunca solo color). Todo con `role="img"` + `[attr.aria-label]`. `prefers-reduced-motion`: sin animación de entrada (`.chart-animate` solo si `matchMedia('(prefers-reduced-motion: reduce)')` es false).

- Form system:
  - `export type FieldType = 'text' | 'email' | 'password' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'time' | 'textarea'`
  - `export interface FieldOption { label: string; value: string | number | boolean }`
  - `export interface FieldConfig { key: string; label: string; type: FieldType; required?: boolean; options?: FieldOption[]; placeholder?: string; disabled?: boolean; section?: string; width?: 'full' | 'half' }`
  - `FormDialogData { title: string; subtitle?: string; fields: FieldConfig[]; values?: Record<string, unknown>; submitLabel?: string; icon?: string }`
  - `FormDialogComponent` (abierto con `MatDialog`): construye un `FormGroup` tipado vía `FormsService.buildForm(fields, values)`, renderiza cada campo según `type` con validators (`Validators.required`, email para `email`, minLength 8 para `password` nuevo), secciones si `field.section` presente. Comportamiento: no muestra errores antes de `touched`; al submit deshabilita Guardar (`submitting`), conserva valores si el POST falla (el diálogo NO se cierra, se muestra error en snackbar via Toast), al éxito cierra con `{ form, values }`; `FormsService.focusFirstError(form, fields)`.
  - `FormDrawerComponent`: misma mecánica pero en un `mat-drawer`/panel lateral (ancho 480px, en móvil 100%), para formularios medianos. Usar `MatDrawerContainer` dentro del componente list o un overlay personalizado. Implementación recomendada: reutilizar `MatDialog` con `panelClass='drawer-dialog'` + CSS que lo coloque a la derecha a pantalla completa de alto, con animación ease-out. (No usar `mat-drawer` anidado para evitar conflictos de layout.)
  - `FormsService`:
    - `buildForm(fields: FieldConfig[], values?: Record<string, unknown>): FormGroup`
    - `focusFirstError(form: FormGroup): void`
    - `getValue(form: FormGroup, fields: FieldConfig[]): Record<string, unknown>` (serializa solo keys definidas)
  - `FormsModule`, `ReactiveFormsModule` imports necesarios.

- [ ] **Step 1:** crear `breadcrumbs`, `confirm-dialog` + service, `filter-bar`, `responsive-table`, `simple-chart`.
- [ ] **Step 2:** crear `forms/*` (fields, service, dialog, drawer).
- [ ] **Step 3:** verificar `npx ng build --configuration production`.
- [ ] **Step 4:** smoke test manual en dev server: abrir un diálogo de prueba en una vista temporal y verificar foco atrapado, `touched` errors y drawer responsive. Revertir.
- [ ] **Step 5:** Commit — `git add frontend/src/app/shared && git commit -m "feat: componentes compartidos de interacción y sistema de formularios"`.

### Task 5: Layout principal (shell)

**Files:**
- Modify: `frontend/src/app/shared/shell/shell.component.ts` (reescribir)
- Create: `frontend/src/app/shared/shell/change-password.component.ts` (diálogo)

**Interfaces:**
- Sidebar: ancho expandido `272px`, contraído `76px`. Preferencia persistida en `localStorage['sau.sidebar']` ('collapsed' | 'expanded'). Estado `collapsed` controlado por botón en topbar (y auto-colapso en pantallas <1280px por defecto? No: el spec dice recordar preferencia; default expandido en desktop). En `<960px`: `mode=over`, drawer superpuesto, se cierra al navegar.
- Grupos de menú (etiquetas en español, mayúsculas solo como etiqueta de grupo pequeña):
  - Inicio: Inicio (`/home`) — todos.
  - PERSONAS (ADMIN): Usuarios (`/admin/users`), Estudiantes (`/admin/students`), Docentes (`/admin/teachers`).
  - ACADÉMICO (ADMIN): Carreras, Materias, Comisiones, Inscripciones.
  - ASISTENCIA: Aulas (ADMIN), Horarios (ADMIN), Clases (ADMIN+DOCENTE en `/admin/classes`), Mis Clases (DOCENTE en `/teacher/classes`), Reportes (ADMIN+AUDITOR), Escanear QR (ALUMNO), Mi Asistencia (ALUMNO).
  - ADMINISTRACIÓN (ADMIN): Auditoría (`/admin/audit`).
- Contraído: solo `mat-icon` con `[matTooltip]="item.label"` y `aria-label`. Los grupos muestran solo un separador.
- Activo: `routerLinkActive` con píldora de fondo tinte primario + `mat-icon` tinte.
- Topbar: botón menú (toggle colapsar en desktop / abrir drawer en móvil), `<app-breadcrumbs>` con crumbs derivados de la ruta actual (mapa ruta→título), spacer, botón tema (oscuro/claro), campana con badge contador (eventos WS no leídos: contar `checkin_confirmed`/`class-started` del `NotificationService`; hacer clic limpia), avatar + menú de perfil (Nombre + roles como texto corto, "Cambiar contraseña", "Cerrar sesión").
- `ChangePasswordComponent`: diálogo `MatDialog` con `FormGroup` tipado `{ current_password (required), new_password (required, min 8), confirm (igual a new_password) }`, submit → `POST /auth/change-password` `{ current_password, new_password }`, maneja error "Contraseña actual incorrecta", éxito → cierra y toast.

- [ ] **Step 1:** reescribir `shell.component.ts` completo (template + styles + lógica). Importar: `ThemeService`, `NotificationService` (ya existe, agregar contador de no leídos), `BreakpointObserver`, `MatMenuModule`, `MatBadgeModule`, `MatTooltipModule`, `MatDividerModule`, `app-breadcrumbs`, `ConfirmDialogService` no necesario aquí (logout sin confirmación requerida). Mapa `BREADCRUMBS: Record<string,string>` para títulos de ruta.
- [ ] **Step 2:** crear `change-password.component.ts`.
- [ ] **Step 3:** ampliar `NotificationService` con `unread$: BehaviorSubject<number>` (incrementa en `checkin_confirmed`/`class-started`, `clear()` lo resetea) manteniendo la API actual (`start()`, mensajes toast).
- [ ] **Step 4:** verificar visualmente los 3 estados (desktop expandido, desktop contraído con tooltips, móvil drawer) en el dev server y compilar `ng build --configuration production`.
- [ ] **Step 5:** Commit — `git add frontend/src/app/shared/shell frontend/src/app/core/services/notification.service.ts && git commit -m "feat: layout principal con sidebar colapsable, topbar y menú de perfil"`.

---

## Etapa 2 — Dashboard, Login, estados globales

### Task 6: Dashboard por rol

**Files:**
- Create: `frontend/src/app/core/services/dashboard.service.ts`
- Modify: `frontend/src/app/views/home/home.component.ts` (reescribir)

**Contratos backend usados (ya verificados):**
- `GET /dashboard/summary` → `{ classes_today, active_classes, attendance_rate_today?, pending_justifications, low_attendance_students, upcoming_classes[], next_class?, recent_attendance[], subjects_at_risk[], recent_audit[] }`
- `GET /reports/attendance?dimension=student&from_date&to_date` → `[{student_id, registration_number, student_name, total_classes, present, late, absent, justified, review, attendance_rate}]` (ADMIN/AUDITOR/DOCENTE)
- `GET /reports/students/low-attendance` (ADMIN/AUDITOR/DOCENTE)
- `GET /attendance/me` → `Attendance[]` (ALUMNO)

**DashboardService:**
- `loadSummary(): Promise<DashboardSummary>` (wrap de `/dashboard/summary`)
- `loadSeries(period: 'today' | 'week' | 'month'): Promise<{ evolution: ChartDatum[]; distribution: ChartDatum[] }>`
  - `today`: 1 ventana `[hoy, hoy]`.
  - `week`: 7 ventanas diarias (lunes–domingo actual o últimos 7 días hábiles). `Promise.all` de 7 calls con `dimension=student`.
  - `month`: 5 ventanas semanales (semana natural). 5 calls.
  - Cada ventana: suma `present+late+justified+absent` de todas las filas → `{label: fecha corta, value: total}` para `evolution`; y suma de `present/late/absent/justified` en la ventana completa para `distribution` (`[{label:'Presente',value}...]`). Guard en `today` (1 punto).
  - Para ALUMNO: `loadStudentStats(): Promise<{ overall: number; perSubject: {subject, pct}[] }>` desde `/attendance/me` (rate = `(present+late+justified)/total*100` por materia y global).
- Todos los métodos con `try/catch` que degradan a `[]`/`null` sin romper la vista.

**HomeComponent** (reescribir por rol):
- Encabezado con `<app-page-header>` y saludo contextual ("Buenos días, María" según hora + subtítulo "Este es el resumen de asistencia del {fecha}"). Selector de período `mat-button-toggle-group` "Hoy | Esta semana | Este mes" visible para ADMIN/AUDITOR (y DOCENTE).
- ADMIN:
  - Fila 1 (KpiCards clicables): Clases de hoy (→`/admin/classes`), Clases activas (→`/admin/classes`), Asistencia promedio (`attendance_rate_today`, →`/admin/reports`), Alumnos en riesgo (`low_attendance_students`, →`/admin/reports`), Justificaciones pendientes (→`/admin/reports`). Color semántico, `loading` con skeleton, `trend` opcional nulo.
  - Fila 2: `simple-chart type=line` "Evolución de asistencia" (período seleccionado); `simple-chart type=donut` "Distribución presente/tarde/ausente"; tarjeta "Próximas clases" (lista `upcoming_classes` con status-chips); tarjeta "Alertas administrativas" (justificaciones pendientes + baja asistencia con links).
  - Fila 3: "Alumnos en riesgo" (tabla compacta desde `low-attendance` endpoint), "Actividad reciente" (`recent_attendance` + `recent_audit` para admin), "Accesos rápidos" (botones a students/commissions/classrooms/classes).
- DOCENTE:
  - Tarjeta "Próxima clase" con botón primario "Iniciar clase" (→`/admin/classes/{next_class.id}` si `SCHEDULED`, si `ACTIVE` → "Ver en vivo").
  - "Mis comisiones" (`upcoming_classes` agrupados), "Asistencia semanal" (serie `week`), "Justificaciones pendientes", "Alumnos en riesgo" (low-attendance), "Actividad reciente".
- ALUMNO:
  - Botón grande "Escanear asistencia" (`/student/scan`), "Próxima clase" (next_class), "Mi asistencia" (overall % con anillo donut simple + por materia `perSubject` con barras), "Materias en riesgo" (`subjects_at_risk` con %), "Últimas asistencias" (recent_attendance con status-chips), atajo "Ver justificaciones" (toast "Podés justificar desde el detalle de una inasistencia" — no hay endpoint de UI de justificaciones; si existe UI pendiente, se omite y solo se muestran las tarjetas soportadas).
- AUDITOR:
  - Igual que ADMIN en lectura: KPIs, gráficos, reportes (links), "Actividad de auditoría" (`recent_audit`). SIN accesos de creación/edición (sin tarjeta de accesos rápidos).

- [ ] **Step 1:** crear `dashboard.service.ts`.
- [ ] **Step 2:** reescribir `home.component.ts` (template por rol con `*ngIf` sobre `isAdmin/isAuditor/isStudent/isDocente`).
- [ ] **Step 3:** verificar en dev server logueado como cada uno de los 4 roles (`admin@universidad.edu/Admin123!`, `docente.demo@universidad.edu/Ejemplo123!`, `alumno.demo@universidad.edu/Ejemplo123!`, `auditor.demo@universidad.edu/Ejemplo123!`). Cargar datos reales. `ng build --configuration production`.
- [ ] **Step 4:** Commit — `git add frontend/src/app/core/services/dashboard.service.ts frontend/src/app/views/home && git commit -m "feat: dashboard por rol con KPIs, gráficos y período"`.

### Task 7: Login rediseñado

**Files:**
- Modify: `frontend/src/app/views/login/login.component.ts` (reescribir)

**Interfaces:**
- Split layout desktop: panel institucional izquierdo (55%, fondo gradiente indigo→slate, logo `qr_code_2` grande, nombre "Sistema de Asistencia Universitaria", párrafo breve, e ítems informativos discretos "Registro por QR · Geolocalización · Control horario" en fila inferior atenuada) + formulario derecho (email/usuario, contraseña con toggle mostrar/ocultar, error con `role="alert"`, botón "Ingresar" con spinner, enlace "¿Olvidaste tu contraseña?" → snackbar informativo "Contactá al administrador del sistema para restablecerla.").
- Mobile (<960px): solo logotipo pequeño + formulario, panel institucional oculto.
- Mantener lógica de `submit()`/`redirect()` exactamente igual.

- [ ] **Step 1:** reescribir `login.component.ts`.
- [ ] **Step 2:** verificar flujo de login OK/error en dev server + `ng build --configuration production`.
- [ ] **Step 3:** Commit — `git add frontend/src/app/views/login && git commit -m "feat: login con composición dividida y accesibilidad"`.

---

## Etapa 3 — Listados, formularios, confirmaciones

### Task 8: Migrar los listados CRUD al patrón compartido (parte 1: diálogos breves)

**Files (modify):**
- `frontend/src/app/views/admin/careers/careers.component.ts`
- `frontend/src/app/views/admin/subjects/subjects.component.ts`
- `frontend/src/app/views/admin/classrooms/classrooms.component.ts`
- `frontend/src/app/views/admin/schedules/schedules.component.ts`
- `frontend/src/app/views/admin/enrollments/enrollments.component.ts`

**Interfaces:**
- Estructura común por listado: `<app-page-header>` (título, subtítulo, icono, breadcrumbs, primaryAction "Nuevo X"), `<app-filter-bar>` (buscador + selects de filtro propios + `resultCount` + `primaryAction`), `<app-responsive-table>` (columnas con `accessor`/`template` para chips y avatares; `actionsTemplate` con menú de acciones por fila: Ver/Editar/Eliminar — destructivas en el menú), estados `<app-loading-skeleton>`, `<app-empty-state>`, `<app-error-state>`.
- Formularios: se abren con `MatDialog` + `FormDialogComponent` con `fields` (breves):
  - Carreras: name, code, description(optional). Lista: nombre (avatar con iniciales), código, descripción, chip estado (Activa/Inactiva).
  - Materias: name, code, career_id(select), semester(number), credits(number). Lista: nombre, código, carrera, semestre, créditos, chip.
  - Aulas: name, code, building, floor, latitude(number), longitude(number), radius_meters(number). Lista: nombre, código, edificio, piso, radio.
  - Horarios: commission_id(select), classroom_id(select), day_of_week(select 1..7), start_time(time), end_time(time). Lista: comisión, materia, aula, día (nombre en español), inicio-fin.
  - Inscripciones: student_id(select), commission_id(select), status(select ACTIVE/INACTIVE con labels). Lista: alumno, legajo, comisión, chip estado.
- Cada listado conserva sus llamadas API exactas (GET colección + POST/PATCH/DELETE). `delete` usa `ConfirmDialogService.openConfirm` con título, nombre del elemento y consecuencia ("Esta acción no se puede deshacer."). Tras eliminar/crear/editar recarga la lista.
- Búsqueda/filtros: client-side sobre la lista cargada (endpoints no exponen búsqueda uniforme; para `users`/`students`/`teachers`/`enrollments` existe paginado server, ver Task 9; en esta task los listados breves usan filtrado local con `Page` no involucrada).

- [ ] **Step 1:** migrar `careers` como referencia completa (código completo de ejemplo abajo), probar en dev server.
- [ ] **Step 2:** migrar `subjects`, `classrooms`, `schedules`, `enrollments` con el mismo patrón.
- [ ] **Step 3:** `ng build --configuration production` + smoke test de alta/edición/borrado (con diálogo de confirmación) en cada uno.
- [ ] **Step 4:** Commit — `git add frontend/src/app/views/admin/careers frontend/src/app/views/admin/subjects frontend/src/app/views/admin/classrooms frontend/src/app/views/admin/schedules frontend/src/app/views/admin/enrollments && git commit -m "feat: listados CRUD breves con patrón compartido y confirmaciones"`.

### Task 9: Migrar los listados CRUD (parte 2: formularios medianos en drawer + usuarios/auditoría)

**Files (modify):**
- `frontend/src/app/views/admin/students/students.component.ts`
- `frontend/src/app/views/admin/teachers/teachers.component.ts`
- `frontend/src/app/views/admin/users/users.component.ts`
- `frontend/src/app/views/admin/commissions/commissions.component.ts`
- `frontend/src/app/views/admin/audit/audit.component.ts`

**Interfaces:**
- Formularios medianos (Estudiantes, Docentes, Usuarios, Comisiones) en `FormDrawerComponent`:
  - Estudiantes: secciones "Datos personales" (full_name, dni, email) y "Datos académicos" (registration_number, career_id select, year). Al editar, password queda opcional.
  - Docentes: full_name, email, username, password (solo alta), employee_number, title, department.
  - Usuarios: full_name, email, username, password (solo alta), roles multiselect (labels en español vía ROLE_LABELS), is_active checkbox. **No permitir eliminar al propio usuario logueado** (botón deshabilitado con tooltip "No podés eliminar tu propia cuenta").
  - Comisiones: name, code, subject_id(select), career_id(select), teacher_id(select), year(number), period(select "1|2"), capacity(number), active(checkbox).
- Auditoría: read-only. `GET /audit` paginado (usar `Page<AuditLog>`). `app-responsive-table` con columnas fecha, usuario, acción (con `ROLE_LABELS` no aplica; acción en español cuando el mapa exista, p.ej. `action` raw es un verbo backend como `user.create`; mostrar el texto tal cual — no inventar traducción), entidad, detalle. Filtro por texto (local) y botón exportar NO aplica (no hay endpoint). Paginación cliente.
- Todos los borrados con `ConfirmDialogService`.

- [ ] **Step 1:** migrar `students` como referencia completa.
- [ ] **Step 2:** migrar `teachers`, `users`, `commissions`, `audit`.
- [ ] **Step 3:** `ng build --configuration production` + smoke test (alta/edición con drawer, borrado con confirm, validación no antes de touched, conserva valores en error).
- [ ] **Step 4:** Commit — `git add frontend/src/app/views/admin/students frontend/src/app/views/admin/teachers frontend/src/app/views/admin/users frontend/src/app/views/admin/commissions frontend/src/app/views/admin/audit && git commit -m "feat: listados medianos con drawer, usuarios y auditoría"`.

---

## Etapa 4 — Clases, QR, escáner

### Task 10: Listado de clases (calendario/lista) y detalle de clase

**Files:**
- Modify: `frontend/src/app/views/admin/classes/classes.component.ts` (reescribir)
- Modify: `frontend/src/app/views/admin/classes/class-detail.component.ts` (reescribir)

**Interfaces:**
- Listado: toggle `mat-button-toggle-group` "Calendario | Lista". Lista = `app-responsive-table` con columnas Materia, Comisión, Docente, Aula, Horario, Estado (status-chip kind='class'), Presentes/Inscriptos, Acción principal ("Ver" / "Iniciar"). Colores de estado en tarjeta/calendario: Programada azul (primary), En curso verde con punto animado discreto (`.pulse` 2s ease-out, desactivado bajo reduced-motion), Finalizada gris, Cancelada rojo suave. Calendario = grilla mensual simple (mes actual, navegación ‹ ›, celdas con eventos del día como píldoras de color según estado, click → detalle). Crear clase con `FormDialogComponent` (commission_id select, date, title).
- Detalle: dos columnas en desktop (principal + lateral `360px`), una en móvil.
  - Principal: header con materia/comisión y status-chip; bloque QR: `<img>` 260px, contador regresivo de expiración (`setInterval` 1s desde `expires_at`), estado "Vigente" (chip verde) / "Vencido" (chip rojo, botón "Regenerar QR"), botón "Pantalla completa" (`requestFullscreen()` sobre el bloque), auto-regeneración cuando vence si la clase sigue ACTIVE (opcional: botón manual suficiente). Tabla "Asistencias en vivo" (WS `checkin`) con resaltado breve de fila nueva (`@starting-style`/class toggle `.row-new` 1s, luego removeClass), método, distancia, hora y status-chip.
  - Lateral: datos de la clase (comisión, aula, fecha, horario, docente), métricas (Presentes/Inscriptos, %), acciones (Iniciar/Finalizar/Generar QR) con GPS en `start` igual que hoy.
- Mantener: `startClass()` con GPS, `finishClass()` revoca QR, `generateQr()` → `POST /classes/{id}/qr` + `qrcode.toDataURL`.

- [ ] **Step 1:** reescribir `classes.component.ts`.
- [ ] **Step 2:** reescribir `class-detail.component.ts`.
- [ ] **Step 3:** verificar flujo completo en dev server (crear clase → iniciar → QR con cuenta regresiva → escanear con alumno → ver fila en vivo destacada → finalizar) + `ng build --configuration production`.
- [ ] **Step 4:** Commit — `git add frontend/src/app/views/admin/classes && git commit -m "feat: clases con vista calendario/lista y detalle con QR en vivo"`.

### Task 11: Escáner QR

**Files:**
- Modify: `frontend/src/app/views/student/scan/scan.component.ts` (reescribir)

**Interfaces:**
- Estados visuales (`ngSwitch`):
  1. `idle` (antes de iniciar): icono, "Escaneá el código mostrado por el docente", nota discreta "Necesitaremos acceso a la cámara y ubicación solamente durante el registro.", botón `mat-flat-button` grande "Activar cámara".
  2. `scanning`: video amplio (`height` mínimo 320px, `object-fit: cover`), marco rectangular (`.scan-frame` con borde + `.scan-line` animada vertical ease-in-out, desactivada con reduced-motion), botones: linterna (si `navigator.mediaDevices.getSupportedConstraints().torch` existe — `applyConstraints({torch:true})`, toggle), selector de cámara (`enumerateDevices` → select enfrentado/trasera o por deviceId), cancelar. Overlay "Buscando código…".
  3. `checking`: pasos con spinner y checkmarks secuenciales: "Verificando QR" → "Comprobando ubicación" → "Registrando asistencia" (simulación por etapas con `setTimeout` cortos; la validación real ya está en el backend). `aria-live="polite"`.
  4. `success`: tarjeta verde con `✓ Asistencia registrada`, datos (materia, comisión, fecha/hora, chip "Presente"/"Tarde"), botón "Ver mi asistencia" → `/student/history`.
  5. `error`: tarjeta roja con mensaje claro y **acción concreta** según causa (mapeo del `detail` del backend → español + acción):
     - permiso cámara negado → "Activá el permiso de cámara en tu navegador" + botón "Reintentar".
     - GPS desactivado → "Activá la ubicación del dispositivo" + botón "Reintentar".
     - precisión insuficiente → "Acercate y esperá a que mejore la señal" + botón "Reintentar".
     - fuera del aula → "Estás fuera del radio del aula" + botón "Ver mapa" no disponible → "Volver a intentar".
     - QR vencido → "El código venció" + "Pedí un nuevo código al docente".
     - QR inválido → "El código no es válido" + "Pedí el código correcto al docente".
     - ya registrada → "Ya registraste tu asistencia" + botón "Ver mi asistencia".
  - El `aria-live` se aplica al bloque de resultado. Foco se mueve al resultado al cambiar de estado.
- Mantener la lógica de lectura (`BrowserQRCodeReader`), `check-in` POST con GPS, `stopCamera`.

- [ ] **Step 1:** reescribir `scan.component.ts` con los 5 estados y el mapeo de errores (extraer `mapError(e): {title, action}`).
- [ ] **Step 2:** verificar en dev server: idle → scan (con fallback simulado si no hay cámara real: el error se muestra con acción Reintentar), y resultado exitoso con un token falso falla → error QR inválido con acción. `ng build --configuration production`.
- [ ] **Step 3:** Commit — `git add frontend/src/app/views/student/scan && git commit -m "feat: escáner QR con estados guiados y errores diferenciados"`.

---

## Etapa 5 — Reportes, accesibilidad, responsive, final

### Task 12: Reportes rediseñados

**Files:**
- Modify: `frontend/src/app/views/admin/reports/reports.component.ts` (reescribir)

**Interfaces:**
- `<app-page-header>` "Reportes". Filtros superiores (`filter-bar`): carrera (select desde `/careers`), materia (select desde `/subjects`), comisión (select desde `/commissions`), desde, hasta, botón "Aplicar". Indicador "filtros activos" (`activeFilters`).
- KPIs derivados de la ventana seleccionada (llamada `dimension=student`): Asistencia (promedio `attendance_rate`), Presentes (sum), Tarde (sum), Ausentes (sum). KpiCards.
- Gráficos: evolución (series semanales/diarias con el mismo helper de `DashboardService`, reutilizando `loadSeries` con período libre o nuevas ventanas según desde/hasta) + distribución donut presente/tarde/ausente/justificada.
- Tabla "Alumnos con baja asistencia" (`/reports/students/low-attendance`) con status-chips y % con barra de progreso accesible (`role=progressbar aria-valuenow`).
- Exportación CSV/XLSX manteniendo `getBlob` + params exactos. Botones con iconos `file_download`/`table_chart`.
- No comunicar solo por color: las barras/chips siempre llevan texto y porcentajes.

- [ ] **Step 1:** reescribir `reports.component.ts`.
- [ ] **Step 2:** verificar con ADMIN y AUDITOR + `ng build --configuration production`.
- [ ] **Step 3:** Commit — `git add frontend/src/app/views/admin/reports && git commit -m "feat: reportes con KPIs, gráficos y exportación"`.

### Task 13: Pase de accesibilidad, responsive y pulido

**Files:**
- Modify: varios (según auditoría)

- [ ] **Step 1:** auditoría de accesibilidad: contraste AA (verificar combinaciones de `STATUS_TONES` sobre `--surface-card`), `aria-label` en botones icon-only, `th scope="col"` en tablas, diálogos con `aria-labelledby`, `prefers-reduced-motion` en todas las animaciones nuevas (pulse, scan-line, chart), foco visible `:focus-visible` 2px anillo `--color-primary-500`. Corregir hallazgos.
- [ ] **Step 2:** revisión responsive en los 6 viewports (360×800, 390×844, 768×1024, 1024×768, 1366×768, 1440×900): móvil 1 columna, tablet 1-2, desktop grillas; botones primarios full-width en móvil; diálogos `max-width: 92vw`; drawer de formulario 100% en móvil. Corregir breakpoints.
- [ ] **Step 3:** `ng build --configuration production` + `ng serve` y revisión manual de consola (0 errores).
- [ ] **Step 4:** ejecutar `code-review-and-quality` skill sobre el diff completo y corregir hallazgos.
- [ ] **Step 5:** Commit — `git add -A && git commit -m "fix: accesibilidad, responsive y pulido final"`.

### Task 14: Verificación final y entrega

- [ ] **Step 1:** suite backend intacta — `cd backend && source .venv/bin/activate && rm -f test.db && python3 -m pytest tests -q` → expect `97 passed`. Confirmar que NO se tocó `backend/` (excepto el fix de seed ya commiteado en `main`).
- [ ] **Step 2:** `npx ng build --configuration production` exitoso (budgets OK).
- [ ] **Step 3:** verificar rutas de los 4 roles con el dev server (navegación por menú, permisos ocultos).
- [ ] **Step 4:** capturas de pantalla escritorio y móvil: instalar `puppeteer` (dependencia de dev, SOLO para capturas en el sandbox; no incluirlo en `package.json` definitivo si rompe el presupuesto — usarlo desde `/tmp`) y capturar: login, dashboard admin (desktop + 390px), listado con mobile-cards, detalle de clase con QR, escáner, reportes. Guardar en `docs/superpowers/screenshots/`.
- [ ] **Step 5:** si puppeteer no funciona (sin chromium en el entorno), documentar la imposibilidad y entregar la explicación de decisiones visuales por escrito.
- [ ] **Step 6:** redactar `docs/superpowers/rediseno-ui.md` (entregable): archivos modificados, componentes creados, decisiones visuales, resultados de pruebas/compilación, problemas pendientes, confirmación de que no se modificó el backend.

---

## Criterios de aceptación — mapeo

| Criterio | Task que lo cubre |
| --- | --- |
| Todas las rutas funcionan | Tasks 5-12 (ninguna ruta se toca) |
| Solo opciones autorizadas | Task 5 (menú por rol) + guards intactos |
| Sin estados en inglés | Task 2 (maps) + uso en Tasks 3,6,8-12 |
| CRUD con patrón común | Tasks 8-9 |
| Tablas con alternativa móvil | Task 4 (responsive-table) + Tasks 8-9 |
| Borrados con diálogo | Task 4 (confirm-dialog) + Tasks 8-9 |
| Dashboard por rol | Task 6 |
| Escáner explica cada estado | Task 11 |
| Sin errores en consola | Task 13 + 14 |
| Compila en producción | todas las tasks |
| Lighthouse ~ a11y 90+, BP 90+, Perf 80+, PWA | Task 13-14 (auditoría + verificación) |
| Capturas escritorio/móvil | Task 14 |
