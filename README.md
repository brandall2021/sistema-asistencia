# Sistema de Asistencia Universitaria

Sistema web / PWA para el control de asistencia a clases mediante **QR dinámico**, **geolocalización GPS** y **control horario**, con roles, auditoría y notificaciones en tiempo real vía WebSocket.

Repo: <https://github.com/brandall2021/sistema-asistencia>

---

## Índice

1. [Stack tecnológico](#stack-tecnológico)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Modelo de datos](#modelo-de-datos)
4. [Reglas de negocio](#reglas-de-negocio)
5. [API REST](#api-rest)
6. [WebSocket en tiempo real](#websocket-en-tiempo-real)
7. [Autenticación y seguridad](#autenticación-y-seguridad)
8. [Variables de entorno](#variables-de-entorno)
9. [Desarrollo local](#desarrollo-local)
10. [Tests](#tests)
11. [Despliegue con Docker (standalone)](#despliegue-con-docker-standalone)
12. [Despliegue en Dokploy](#despliegue-en-dokploy)
13. [Flujo de uso completo](#flujo-de-uso-completo)

---

## Stack tecnológico

| Capa | Tecnología |
| --- | --- |
| Frontend | Angular 21 + Angular Material + PWA (Service Worker) |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic 2 + Alembic |
| Autenticación | JWT (access 30 min / refresh 7 días) + Argon2 |
| Cache / rate-limit | Redis (con fallback en memoria para entornos sin Redis) |
| Base de datos | PostgreSQL 16 (SQLite para tests y desarrollo local) |
| Tiempo real | WebSocket (FastAPI) |
| Infra | Docker Compose + Nginx (HTTPS + WebSocket) |
| PaaS | Dokploy (Nginx Proxy Manager + Let's Encrypt) |

---

## Estructura del proyecto

```
sistema-asistencia/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers: auth, users, students, teachers, careers,
│   │   │                    #   subjects, commissions, enrollments, classrooms,
│   │   │                    #   schedules, classes, attendance, reports, audit, ws
│   │   ├── core/            # config, security, rate_limit, token_store, audit, deps
│   │   ├── db/              # base, session, seed (roles + admin inicial)
│   │   ├── models/          # 17 tablas SQLAlchemy
│   │   ├── schemas/         # Pydantic v2 (entrada/salida)
│   │   └── services/        # geo (Haversine), qr (tokens), attendance, ws
│   ├── alembic/             # migraciones de esquema
│   ├── tests/               # pytest (59 tests)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/                # Angular + Material + PWA
│   ├── src/app/core/        # models, guards, interceptors, servicios (auth, api, ws)
│   ├── src/app/shared/      # shell (menú por rol, responsive)
│   ├── src/app/views/       # login, home, admin/*, student/*
│   ├── Dockerfile           # nginx con TLS (deploy standalone)
│   ├── Dockerfile.dokploy   # nginx solo HTTP (deploy Dokploy)
│   ├── nginx.conf           # TLS + proxy /api (incluye WebSocket)
│   └── nginx.dokploy.conf   # HTTP + proxy /api (incluye WebSocket)
├── docker-compose.yml         # despliegue standalone (TLS)
├── docker-compose.dokploy.yml # despliegue en Dokploy
├── .env.example
└── README.md
```

### Frontend: vistas por rol

| Rol | Vistas |
| --- | --- |
| ADMIN | Inicio (dashboard), Usuarios, Estudiantes, Docentes, Carreras, Materias, Comisiones, Inscripciones, Aulas, Horarios, Clases, Reportes, Auditoría |
| DOCENTE | Inicio (dashboard), Mis Clases (solo sus comisiones), detalle de clase con QR y asistencia en vivo |
| ALUMNO | Inicio (dashboard), Escanear QR, Mi Asistencia (historial) |
| AUDITOR | Inicio (dashboard), Reportes (solo lectura) |

---

## Modelo de datos

17 tablas gestionadas con Alembic (migración inicial `07ead28ac650_initial_schema`):

| Tabla | Descripción |
| --- | --- |
| `users` | Usuarios del sistema (login, contraseña argon2, activo) |
| `roles` | Catálogo de roles: `ADMIN`, `DOCENTE`, `ALUMNO`, `AUDITOR` |
| `user_roles` | Relación N:M usuario ↔ rol |
| `students` | Alumnos (legajo, usuario vinculado) |
| `teachers` | Docentes (usuario vinculado) |
| `careers` | Carreras |
| `subjects` | Materias (pertenecen a una carrera) |
| `commissions` | Comisiones de una materia (año, cuatrimestre, docente a cargo) |
| `enrollments` | Inscripciones de alumnos a comisiones (`ACTIVE`/`INACTIVE`) |
| `classrooms` | Aulas (nombre, ubicación lat/lon, radio en metros) |
| `schedules` | Horarios (comisión, día de semana, hora inicio/fin, aula) |
| `classes` | Sesiones de clase (comisión, aula, fecha, hora, estado) |
| `qr_sessions` | Tokens QR dinámicos (solo se guarda el hash SHA-256) |
| `attendance` | Asistencias (estado, método, hora, geolocalización) |
| `attendance_events` | Eventos de asistencia (para notificación en tiempo real) |
| `justifications` | Justificaciones de inasistencia |
| `audit_logs` | Auditoría de acciones sensibles |

### Estados (enums)

- **Clase**: `SCHEDULED`, `ACTIVE`, `FINISHED`, `CANCELLED`
- **Asistencia**: `PRESENT`, `LATE`, `ABSENT`, `JUSTIFIED`, `REVIEW`, `REJECTED`
- **Justificación**: `PENDING`, `APPROVED`, `REJECTED`
- **Inscripción**: `ACTIVE`, `INACTIVE`
- **Check-in**: `QR`, `MANUAL`

---

## Reglas de negocio

### QR dinámico

- Cada QR es un token aleatorio de **48 bytes** con vida de **30–60 s** (por defecto **45 s**).
- El servidor guarda **solo el hash SHA-256** del token y **resuelve la clase desde el token**, nunca confía en un `class_id` enviado por el cliente.
- Generar un nuevo QR **revoca los anteriores**; finalizar la clase los revoca todos.
- Solo se puede generar un QR mientras la clase está `ACTIVE`.

### Geolocalización

- Se captura la ubicación **solo en el check-in** (sin seguimiento permanente).
- La distancia al aula se calcula con la fórmula de **Haversine**.
- Se rechaza el check-in si `accuracy > GPS_MAX_ACCURACY` (**25 m** por defecto) o si `distance > radius_meters` del aula.
- El docente ve una marca de localización en cada asistencia registrada.

### Asistencia y control horario

- Estados: `PRESENT, LATE, ABSENT, JUSTIFIED, REVIEW, REJECTED`.
- Regla `UNIQUE(class_id, student_id)`: **una sola asistencia** por estudiante y clase.
- Tolerancia de llegada tarde: `LATE_GRACE_MINUTES` (**10 min** por defecto) tras el horario de la clase.
- Validaciones del check-in: token válido/no vencido, clase activa, alumno inscripto, GPS disponible/preciso/dentro del radio, sin asistencia previa.
- El alumno ve su historial en `/attendance/me`.
- El docente puede cambiar estados (`change_status`) y revisar justificaciones (`review`).
- Los justificativos quedan `PENDING` hasta que el docente los aprueba o rechaza.

### Roles y permisos

- `ADMIN`: gestión completa de todo el catálogo (usuarios, alumnos, docentes, carreras, materias, comisiones, inscripciones, aulas, horarios, clases, reportes, auditoría).
- `DOCENTE`: solo sus comisiones (`commission.teacher_id == user.id`); no puede ver datos de otras.
- `ALUMNO`: escaneo de QR + historial propio.
- `AUDITOR`: reportes de solo lectura.

### Auditoría

- Toda acción sensible (login, cambios de estado, borrados, etc.) se registra en `audit_logs`.
- El endpoint `GET /audit` permite consultarlos (solo ADMIN).

---

## API REST

Todas las rutas están bajo el prefijo `API_V1_PREFIX` (**`/api/v1`**). La documentación interactiva (Swagger) queda en `GET /docs`.

### Autenticación (`/auth`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/auth/login` | Login, devuelve access + refresh token (con rate-limit) |
| POST | `/auth/refresh` | Renueva el access token con el refresh token |
| POST | `/auth/logout` | Revoca el refresh token |
| GET | `/auth/me` | Datos del usuario autenticado (con roles) |
| POST | `/auth/change-password` | Cambio de contraseña (requiere la actual) |

### CRUD de catálogo (`/users`, `/students`, `/teachers`, `/careers`, `/subjects`, `/commissions`, `/enrollments`, `/classrooms`, `/schedules`)

Cada recurso expone el mismo patrón (acceso ADMIN):

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/{recurso}` | Listado (paginado en users/students/teachers/enrollments) |
| POST | `/{recurso}` | Crear |
| GET | `/{recurso}/{id}` | Detalle |
| PATCH | `/{recurso}/{id}` | Actualizar |
| DELETE | `/{recurso}/{id}` | Eliminar |

### Clases (`/classes`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/classes` | Listado (docente ve solo sus comisiones) |
| POST | `/classes` | Crear sesión |
| GET | `/classes/{id}` | Detalle |
| PATCH | `/classes/{id}` | Actualizar |
| POST | `/classes/{id}/start` | Iniciar la clase → estado `ACTIVE` |
| POST | `/classes/{id}/finish` | Finalizar la clase → estado `FINISHED` y revoca QRs |
| GET | `/classes/{id}/attendance` | Asistencias de la clase |
| POST | `/classes/{id}/qr` | Genera un QR dinámico (devuelve token + expiración) |

### Asistencia (`/attendance`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/attendance/check-in` | Check-in por QR (token + lat/lon + accuracy) |
| GET | `/attendance/me` | Historial del alumno autenticado |
| GET | `/attendance/class/{class_id}` | Asistencias de una clase (paginado) |
| PATCH | `/attendance/{id}/status` | Cambiar estado de una asistencia (docente) |
| POST | `/attendance/justify` | Solicitar justificación |
| GET | `/attendance/justifications` | Listado de justificaciones |
| POST | `/attendance/justifications/{id}/review` | Aprobar/rechazar justificación (docente) |

### Reportes (`/reports`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/reports/attendance` | Reporte de asistencia por filtros (comisión, materia, fecha) |
| GET | `/reports/students/low-attendance` | Alumnos con baja asistencia |
| GET | `/reports/attendance/export?format=csv\|xlsx` | Exportación a CSV o XLSX |

### Auditoría (`/audit`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/audit` | Registro de acciones sensibles (paginado) |

### Dashboard (`/dashboard`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/summary` | Resumen por rol: clases hoy/activas, tasa de asistencia del día, justificaciones pendientes, alumnos con baja asistencia, próximas clases, asistencia reciente, materias en riesgo (alumno) y últimos eventos de auditoría (admin/auditor). |

El resumen está acotado al alcance del usuario: ADMIN/AUDITOR ven todo, DOCENTE solo sus comisiones y ALUMNO solo sus inscripciones/registros.

---

## WebSocket en tiempo real

- **Se obtiene un ticket de un solo uso**: `POST /auth/ws-ticket` (Bearer access) → `{"ticket": "...", "expires_in": 30}`.
- **URL**: `wss://<host>/api/v1/ws/classes/{class_id}?ticket=<ticket>` — el access token **no viaja en la URL**.
- El ticket: expira en 30 s (configurable), es de un solo uso, está asociado al usuario y a la clase, y se guarda en Redis (con fallback en memoria).
- Por compatibilidad se acepta aún `?token=<access_token>` (deprecado).
- El docente abre el canal al iniciar la clase y ve las asistencias **en vivo**.
- Mensajes del cliente: `{"event": "ping"}`.
- Respuestas del servidor:
  - `{"event": "pong"}` para pings de mantenimiento.
  - `{"event": "checkin", "attendance": {...}}` cuando un alumno hace check-in.
  - `{"event": "error", "detail": "..."}` si la conexión no está autorizada (se cierra con `4401`).
- El frontend reconecta automáticamente ante caídas (backoff).

---

## Autenticación y seguridad

- **JWT HS256**: access token de **30 min** y refresh token de **7 días**, con `iss` propio (`sistema-asistencia-universitaria`).
- Contraseñas con **Argon2** (nunca en claro; seed inicial crea el admin).
- **Refresh tokens revocables y con rotación**: se invalidan en logout y en cada refresh; el backend también emite el refresh en **cookie HttpOnly** (`/api/v1/auth`, `SameSite=lax`, `Secure` en producción) y lo acepta por cookie o por body.
- **Validación de arranque en producción**: el backend se niega a iniciar si `JWT_SECRET_KEY` es el predeterminado/corto (< 32 bytes), `ADMIN_PASSWORD=Admin123!`, la contraseña de PostgreSQL es `asistencia`, o `CORS_ORIGINS` tiene comodines/localhost. Los mensajes no exponen los secretos.
- **Rate limiting** por IP (Redis, con fallback en memoria):
  - Login: `10` intentos / 5 min.
  - Check-in: `5` / 5 min.
  - Resto de la API: `120` / 5 min.
  - `X-Forwarded-For` solo se acepta desde proxies incluidos en `TRUSTED_PROXIES` (IP/CIDR); de otro modo se usa la IP real del peer, impidiendo evadir el límite cambiando la cabecera.
- **CORS** restringido por `CORS_ORIGINS`.
- **Auditoría** de acciones sensibles.
- Importante en producción: cambiar `JWT_SECRET_KEY` y usar credenciales de admin fuertes.

### Deuda técnica registrada

- **Migración de tokens en el navegador pendiente**: el frontend aún guarda access y refresh en `localStorage`. La migración a **access en memoria + refresh en cookie HttpOnly** está soportada por el backend (login/refresh/logout ya fijan/rotan/limpian la cookie) pero no se completó para no romper la autenticación con un cambio parcial. Prioridad alta de seguridad.

---

## Variables de entorno

| Variable | Default | Descripción |
| --- | --- | --- |
| `APP_ENV` | `development` | Entorno (`development`/`production`) |
| `DEBUG` | `false` | Modo debug |
| `DATABASE_URL` | `postgresql+psycopg2://asistencia:asistencia@localhost:5432/asistencia` | Conexión a la base |
| `REDIS_URL` | `redis://localhost:6379/0` | Conexión a Redis |
| `JWT_SECRET_KEY` | `change-me-...` | **Obligatorio cambiarlo en producción** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Vida del access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Vida del refresh token |
| `QR_TOKEN_TTL_SECONDS` | `45` | Vida del QR (rango 30–60) |
| `GPS_MAX_ACCURACY` | `25` | Precisión GPS máxima en metros |
| `LATE_GRACE_MINUTES` | `10` | Tolerancia de llegada tarde |
| `RATE_LIMIT_LOGIN` | `10` | Intentos de login permitidos |
| `RATE_LIMIT_PERIOD_SECONDS` | `300` | Ventana del rate-limit |
| `RATE_LIMIT_CHECKIN` | `5` | Check-ins permitidos |
| `RATE_LIMIT_DEFAULT` | `120` | Límite general |
| `TRUSTED_PROXIES` | *(vacío)* | IP/CIDR de proxies confiables para aceptar `X-Forwarded-For` |
| `REFRESH_COOKIE_NAME` | `refresh_token` | Nombre de la cookie HttpOnly |
| `REFRESH_COOKIE_SECURE` | `false` | `true` en producción (HTTPS) |
| `REFRESH_COOKIE_SAMESITE` | `lax` | `lax` o `strict` |
| `WS_TICKET_TTL_SECONDS` | `30` | Vida del ticket de WebSocket (un solo uso) |
| `CORS_ORIGINS` | `http://localhost:4200,...` | Orígenes CORS separados por coma |
| `ADMIN_EMAIL` | `admin@universidad.edu` | Email del admin inicial |
| `ADMIN_USERNAME` | `admin` | Usuario del admin inicial |
| `ADMIN_PASSWORD` | `Admin123!` | Contraseña del admin inicial |
| `ADMIN_FULL_NAME` | `Administrador del Sistema` | Nombre del admin inicial |

Ver el archivo `.env.example` para el formato.

---

## Desarrollo local

### Backend (SQLite)

Requisitos: Python 3.10+.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Base SQLite local (sin Postgres)
export DATABASE_URL="sqlite:///./asistencia.db"

# Aplicar migraciones y sembrar roles + admin
python3 -m alembic upgrade head

# Levantar la API en http://localhost:8000 (Swagger en /docs)
uvicorn app.main:app --reload --port 8000
```

### Frontend (dev server con proxy a `localhost:8000`)

Requisitos: Node 20+.

```bash
cd frontend
npm install
npm start        # http://localhost:4200
```

`proxy.conf.json` reenvía `/api` (incluido el WebSocket) a `localhost:8000`, de modo que las URLs de entorno (`/api/v1`) funcionan igual que en producción.

---

## Tests

```bash
cd backend
rm -f test.db
python3 -m pytest tests -q        # 59 passed
```

Los tests usan **SQLite** y fallbacks en memoria para Redis (no requieren servicios externos) y cubren: autenticación y RBAC, CRUD completo, flujo QR (generación, expiración, revocación), validación GPS, reglas de asistencia, justificaciones, reportes, auditoría y WebSocket (eventos `pong`/`checkin`, rechazo de conexiones no autorizadas).

---

## Despliegue con Docker (standalone)

Usa `docker-compose.yml` (Postgres + Redis + backend + frontend) y un nginx con **TLS autofirmado** que sirve el frontend y proxya `/api/*` (con soporte WebSocket) al backend.

```bash
cp .env.example .env

# Generá certificados TLS autofirmados (o usá certificados reales):
mkdir -p certs
openssl req -x509 -nodes -newkey rsa:2048 -keyout certs/server.key \
    -out certs/server.crt -days 365 -subj "/CN=asistencia.local"

docker compose up -d --build
```

- Frontend en `https://asistencia.local` (HTTP → HTTPS).
- Backend ejecuta `alembic upgrade head` y siembra roles + administrador en el primer arranque.
- Postgres y Redis persisten en volúmenes (`pgdata`, `redisdata`).

> En producción: cambiá `JWT_SECRET_KEY`, usá certificados firmados por una CA y credenciales de administrador fuertes.

---

## Despliegue en Dokploy

El proyecto incluye `docker-compose.dokploy.yml` (Postgres, Redis, backend y frontend) y un nginx **solo HTTP** (`frontend/nginx.dokploy.conf` + `frontend/Dockerfile.dokploy`): en Dokploy el TLS/HTTPS y el dominio los resuelve su proxy inverso (Nginx Proxy Manager o el dominio adjunto al servicio).

### Pasos

1. **Subí el repositorio** a GitHub (o GitLab/Bitbucket) y conectalo en Dokploy.

2. **Creá el despliegue Compose** en Dokploy apuntando a `docker-compose.dokploy.yml` (o pegá su contenido).

3. **Configurá las variables de entorno** en la UI de Dokploy (mínimas obligatorias):
   - `JWT_SECRET_KEY` (generá una larga y aleatoria)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`
   - `CORS_ORIGINS` → `https://tu-dominio.com`
   - `POSTGRES_PASSWORD` (por defecto `asistencia`)
   - `FRONTEND_PORT` (por defecto `8080`) y `BACKEND_PORT` (por defecto `8000`)

4. **Desplegá.** El backend ejecuta `alembic upgrade head` (crea las 17 tablas) y siembra roles + administrador. PostgreSQL y Redis persisten en volúmenes propios.

5. **Dominio y HTTPS con el proxy de Dokploy.** Creá un host en Nginx Proxy Manager (o adjuntá el dominio al servicio):
   - `tu-dominio.com` → forward a `127.0.0.1:${FRONTEND_PORT}` (ej. `8080`)
   - Habilitá **WebSocket Support** en el host y **Force SSL** con certificado **Let's Encrypt**.
   - No hace falta un subdominio de API: el nginx del frontend proxya `/api/v1/...` y el WebSocket al backend por la red de compose.

6. Entrá a `https://tu-dominio.com`, iniciá sesión con el admin y cargá el flujo completo (abajo).

> Alternativa: si preferís subdominios separados, creá un host de NPM `api.tu-dominio.com` → `127.0.0.1:${BACKEND_PORT}` y dejá `CORS_ORIGINS` con ambos orígenes.

---

## Flujo de uso completo

1. **Carga inicial (admin)**: creá una carrera → materia → comisión (con docente) → inscribí alumnos → creá un aula (con lat/lon y radio) → definí horarios.
2. **Crear una clase (admin o docente)**: elegí comisión, aula y fecha/hora.
3. **Iniciar la clase (docente)**: la clase pasa a `ACTIVE` y el docente abre el detalle, donde ve la asistencia **en vivo** por WebSocket.
4. **Generar el QR (docente)**: se muestra un QR dinámico que expira en 45 s y se regenera con cada refresh.
5. **Check-in (alumno)**: escanea el QR con la cámara; el sistema valida token, GPS (precisión y radio del aula), inscripción y ausencia previa, y registra `PRESENT` o `LATE`.
6. **Finalizar (docente)**: la clase pasa a `FINISHED`, se revocan los QRs y el alumno ya no puede marcar.
7. **Reportes y auditoría (admin/auditor)**: exportación CSV/XLSX, baja asistencia, y trazabilidad de todo lo sensible.
