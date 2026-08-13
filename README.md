# Sistema de Asistencia Universitaria

Sistema web y PWA para control de asistencia universitario con **QR dinámico**, **geolocalización GPS**, **control horario**, roles, auditoría y notificaciones en tiempo real.

Repositorio: <https://github.com/brandall2021/sistema-asistencia>

## Qué incluye

- Login con JWT y roles.
- Dashboard distinto para ADMIN, DOCENTE, ALUMNO y AUDITOR.
- Gestión de carreras, materias, comisiones, estudiantes, docentes, usuarios, aulas, horarios, clases y auditoría.
- Generación y validación de QR con expiración.
- Check-in con GPS y tolerancia por aula.
- Reportes con filtros, KPIs, gráficos y exportación.
- WebSocket para asistencia en vivo y notificaciones.
- Frontend Angular 21 rediseñado con Material 3, tema claro/oscuro y componentes compartidos.

## Índice

1. [Stack tecnológico](#stack-tecnologico)
2. [Estado actual](#estado-actual)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Frontend rediseñado](#frontend-redisenado)
5. [Modelo de datos](#modelo-de-datos)
6. [Reglas de negocio](#reglas-de-negocio)
7. [API REST](#api-rest)
8. [WebSocket en tiempo real](#websocket-en-tiempo-real)
9. [Autenticación y seguridad](#autenticacion-y-seguridad)
10. [Variables de entorno](#variables-de-entorno)
11. [Desarrollo local](#desarrollo-local)
12. [Tests](#tests)
13. [Despliegue con Docker](#despliegue-con-docker)
14. [Despliegue en Dokploy](#despliegue-en-dokploy)
15. [Flujo de uso completo](#flujo-de-uso-completo)

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | Angular 21 + Angular Material 3 + PWA |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic 2 + Alembic |
| Autenticación | JWT HS256 + Argon2 |
| Tiempo real | WebSocket (FastAPI) |
| Base de datos | PostgreSQL en producción, SQLite en desarrollo y tests |
| Cache / tickets | Redis con fallback en memoria |
| Infra | Docker Compose + Nginx + TLS |
| PaaS | Dokploy |

## Estado actual

- Backend verificado con **97/97 tests pasando**.
- Frontend compila en producción con `npx ng build --configuration production`.
- El frontend fue rediseñado con una base visual nueva: tokens, shell, dashboards, tablas responsive, formularios reutilizables y flujo móvil.
- Las cuentas demo del seed usan emails `*.demo@universidad.edu` para no chocar con los fixtures de test.

## Estructura del proyecto

```text
sistema-asistencia/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers auth, users, students, teachers, careers, subjects, commissions, enrollments, classrooms, schedules, classes, attendance, reports, audit, ws
│   │   ├── core/            # config, security, rate limit, token store, audit, deps
│   │   ├── db/              # base, session, seed
│   │   ├── models/          # SQLAlchemy
│   │   ├── schemas/         # Pydantic
│   │   └── services/        # qr, geo, attendance, ws
│   ├── alembic/
│   ├── tests/
│   └── requirements*.txt
├── frontend/
│   └── src/app/
│       ├── core/            # models, guards, services
│       ├── shared/          # shell, componentes, forms
│       └── views/           # login, home, admin/*, student/*
├── docs/
├── docker-compose.yml
├── docker-compose.dokploy.yml
└── README.md
```

## Frontend rediseñado

El frontend actual usa:

- Tokens CSS para colores, radios, sombras, tipografías y breakpoints.
- Tema Material 3 claro/oscuro.
- Shell con sidebar colapsable, breadcrumbs, topbar, notificaciones y menú de perfil.
- Componentes compartidos:
  - `app-page-header`
  - `app-breadcrumbs`
  - `app-status-chip`
  - `app-user-avatar`
  - `app-empty-state`
  - `app-error-state`
  - `app-loading-skeleton`
  - `app-kpi-card`
  - `app-filter-bar`
  - `app-responsive-table`
  - `app-confirm-dialog`
  - `app-simple-chart`
  - `FormDialogComponent`
  - `FormDrawerComponent`
- Vistas principales:
  - Login dividido (institucional + formulario).
  - Dashboard por rol.
  - CRUDs breves con diálogo.
  - CRUDs medianos con drawer.
  - Clases con vista lista/calendario y detalle con QR.
  - Escáner QR con estados guiados.
  - Reportes con KPIs y gráficos.

### Vistas por rol

| Rol | Vistas |
| --- | --- |
| ADMIN | Dashboard, usuarios, estudiantes, docentes, carreras, materias, comisiones, inscripciones, aulas, horarios, clases, reportes, auditoría |
| DOCENTE | Dashboard, clases propias, detalle de clase con QR, reportes de lectura |
| ALUMNO | Dashboard, escáner QR, historial propio |
| AUDITOR | Dashboard de lectura, reportes |

## Modelo de datos

17 tablas gestionadas con Alembic:

| Tabla | Descripción |
| --- | --- |
| `users` | Usuarios del sistema |
| `roles` | Catálogo de roles |
| `user_roles` | Relación N:M usuario-rol |
| `students` | Alumnos |
| `teachers` | Docentes |
| `careers` | Carreras |
| `subjects` | Materias |
| `commissions` | Comisiones |
| `enrollments` | Inscripciones |
| `classrooms` | Aulas |
| `schedules` | Horarios |
| `classes` | Sesiones de clase |
| `qr_sessions` | Tokens QR con hash SHA-256 |
| `attendance` | Asistencias |
| `attendance_events` | Eventos para WebSocket |
| `justifications` | Justificaciones |
| `audit_logs` | Auditoría |

### Estados

- Clase: `SCHEDULED`, `ACTIVE`, `FINISHED`, `CANCELLED`
- Asistencia: `PRESENT`, `LATE`, `ABSENT`, `JUSTIFIED`, `REVIEW`, `REJECTED`
- Justificación: `PENDING`, `APPROVED`, `REJECTED`
- Inscripción: `ACTIVE`, `INACTIVE`
- Check-in: `QR`, `MANUAL`

## Reglas de negocio

### QR dinámico

- El QR expira en 30-60 s (por defecto 45 s).
- El backend guarda solo el hash SHA-256 del token.
- Un nuevo QR revoca el anterior.
- Finalizar la clase revoca todos los QR vigentes.
- Solo se puede generar QR cuando la clase está `ACTIVE`.

### Geolocalización

- La ubicación se usa solo al hacer check-in.
- La distancia al aula se calcula con Haversine.
- Se rechaza si la precisión es mayor a 25 m o si el alumno está fuera del radio del aula.

### Asistencia

- Un alumno solo puede registrar una asistencia por clase.
- La tolerancia para `LATE` es de 10 minutos por defecto.
- El alumno ve su historial en `/attendance/me`.
- El docente puede cambiar estados y revisar justificaciones.

### Roles y permisos

- `ADMIN`: acceso completo.
- `DOCENTE`: solo sus comisiones/clases.
- `ALUMNO`: escaneo y historial propio.
- `AUDITOR`: solo lectura.

## API REST

Todas las rutas cuelgan de `/api/v1`.

### Autenticación

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Renovar access token |
| POST | `/auth/logout` | Revocar refresh token |
| GET | `/auth/me` | Usuario autenticado |
| POST | `/auth/change-password` | Cambio de contraseña |

### Catálogos

| Método | Ruta |
| --- | --- |
| GET/POST/GET/PATCH/DELETE | `/users` |
| GET/POST/GET/PATCH/DELETE | `/students` |
| GET/POST/GET/PATCH/DELETE | `/teachers` |
| GET/POST/GET/PATCH/DELETE | `/careers` |
| GET/POST/GET/PATCH/DELETE | `/subjects` |
| GET/POST/GET/PATCH/DELETE | `/commissions` |
| GET/POST/GET/PATCH/DELETE | `/enrollments` |
| GET/POST/GET/PATCH/DELETE | `/classrooms` |
| GET/POST/GET/PATCH/DELETE | `/schedules` |

### Clases

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/classes` | Listado |
| POST | `/classes` | Crear clase |
| GET | `/classes/{id}` | Detalle |
| PATCH | `/classes/{id}` | Actualizar |
| POST | `/classes/{id}/start` | Iniciar |
| POST | `/classes/{id}/finish` | Finalizar |
| GET | `/classes/{id}/attendance` | Asistencias en vivo |
| POST | `/classes/{id}/qr` | Generar QR |

### Asistencia

| Método | Ruta |
| --- | --- |
| POST | `/attendance/check-in` |
| GET | `/attendance/me` |
| GET | `/attendance/class/{class_id}` |
| PATCH | `/attendance/{id}/status` |
| POST | `/attendance/justify` |
| GET | `/attendance/justifications` |
| POST | `/attendance/justifications/{id}/review` |

### Reportes

| Método | Ruta |
| --- | --- |
| GET | `/reports/attendance` |
| GET | `/reports/students/low-attendance` |
| GET | `/reports/attendance/export?format=csv|xlsx` |

### Auditoría

| Método | Ruta |
| --- | --- |
| GET | `/audit` |

### Dashboard

| Método | Ruta |
| --- | --- |
| GET | `/dashboard/summary` |

## WebSocket en tiempo real

- `POST /auth/ws-ticket` genera un ticket de un solo uso.
- Canal de clase: `/api/v1/ws/classes/{class_id}?ticket=...`
- Canal personal: `/api/v1/ws/notifications?ticket=...`
- Eventos: `pong`, `checkin`, `class-started`, `checkin_confirmed`, `class-update`, `error`.

## Autenticación y seguridad

- JWT HS256: access 30 min, refresh 7 días.
- Contraseñas con Argon2.
- Refresh tokens revocables y rotación al renovar.
- Rate limit por IP para login y check-in.
- CORS restringido.
- Validación de arranque en producción para secretos y credenciales inseguras.

### Deuda técnica registrada

- El frontend todavía usa `localStorage` para tokens.

## Variables de entorno

Ver `.env.example` para el formato completo.

| Variable | Default |
| --- | --- |
| `DATABASE_URL` | `postgresql+psycopg2://asistencia:asistencia@localhost:5432/asistencia` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `JWT_SECRET_KEY` | `change-me...` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `QR_TOKEN_TTL_SECONDS` | `45` |
| `GPS_MAX_ACCURACY` | `25` |
| `LATE_GRACE_MINUTES` | `10` |
| `CORS_ORIGINS` | `http://localhost:4200,...` |
| `ADMIN_EMAIL` | `admin@universidad.edu` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `Admin123!` |

## Desarrollo local

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL="sqlite:///./asistencia.db"
python3 -m alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

El frontend corre en `http://localhost:4200` y proxya `/api/v1` al backend.

## Tests

```bash
cd backend
rm -f test.db
python3 -m pytest tests -q
```

Resultado actual: **97 passed**.

## Despliegue con Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Incluye backend, frontend, PostgreSQL, Redis y Nginx con TLS.

## Despliegue en Dokploy

- Usar `docker-compose.dokploy.yml`.
- Configurar variables en la UI de Dokploy.
- Publicar el frontend detrás del proxy de Dokploy y dejar el backend interno.

## Flujo de uso completo

1. El ADMIN crea carrera, materia, comisión, estudiantes, docentes, aulas y horarios.
2. El ADMIN o DOCENTE crea una clase.
3. El DOCENTE inicia la clase y abre el detalle en vivo.
4. Se genera el QR dinámico para el check-in.
5. El ALUMNO escanea el QR, el backend valida token, GPS e inscripción.
6. El DOCENTE finaliza la clase.
7. ADMIN y AUDITOR consultan reportes y auditoría.

## Cuentas demo

- ADMIN: `admin@universidad.edu` / `Admin123!`
- DOCENTE: `docente.demo@universidad.edu` / `Ejemplo123!`
- ALUMNO: `alumno.demo@universidad.edu` / `Ejemplo123!`
- AUDITOR: `auditor.demo@universidad.edu` / `Ejemplo123!`
