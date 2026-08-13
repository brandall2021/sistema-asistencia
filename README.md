# Sistema de Asistencia Universitaria

Sistema web / PWA para el control de asistencia a clases mediante **QR dinámico**, **geolocalización GPS** y **control horario**, con roles y auditoría.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Angular 21 + Angular Material + PWA (Service Worker) |
| Backend | FastAPI + SQLAlchemy 2 + Pydantic 2 + Alembic |
| Auth | JWT (access 30 min / refresh 7 días) + Argon2 |
| Cache / rate-limit | Redis (con fallback en memoria) |
| Base de datos | PostgreSQL 16 (SQLite para tests locales) |
| Infra | Docker Compose + Nginx (HTTPS + WebSocket) |

## Estructura

```
sistema-asistencia/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # routers (auth, users, students, ... ws)
│   │   ├── core/            # config, security, rate_limit, deps
│   │   ├── db/              # base, session, seed
│   │   ├── models/          # 17 tablas (SQLAlchemy)
│   │   ├── schemas/         # Pydantic v2
│   │   └── services/        # geo, qr, attendance, ws
│   ├── alembic/             # migraciones
│   └── tests/               # pytest (59 tests)
├── frontend/                # Angular + Material + PWA
├── docker-compose.yml
└── .env.example
```

## Reglas de negocio

### QR dinámico
- Cada QR es un token aleatorio de 48 bytes con vida de **30–60 s** (por defecto 45).
- El servidor guarda solo el hash SHA-256 del token y **resuelve la clase desde el token**, nunca confía en un `class_id` enviado por el cliente.
- Generar un nuevo QR revoca los anteriores; finalizar la clase los revoca todos.
- Solo se puede generar un QR mientras la clase está **ACTIVE**.

### Geolocalización
- Se captura la ubicación **solo en el check-in** (sin seguimiento permanente).
- La distancia al aula se calcula con la fórmula de **Haversine**.
- Se rechaza el check-in si `accuracy > GPS_MAX_ACCURACY (25 m)` o si `distance > radius_meters` del aula.

### Asistencia
- Estados: `PRESENT, LATE, ABSENT, JUSTIFIED, REVIEW, REJECTED`.
- Regla `UNIQUE(class_id, student_id)`: una asistencia por estudiante y clase.
- Validaciones del check-in: token válido/no vencido, clase activa, alumno inscripto, GPS disponible/preciso/dentro del radio, sin asistencia previa.
- El alumno ve su historial (`/attendance/me`); el docente puede cambiar estados y revisar justificaciones.

### Roles y permisos
- `ADMIN`: gestión completa (usuarios, estudiantes, docentes, carreras, materias, comisiones, inscripciones, aulas, horarios, clases, reportes, auditoría).
- `DOCENTE`: solo sus comisiones (`commission.teacher_id == user.id`).
- `ALUMNO`: escaneo de QR + historial propio.
- `AUDITOR`: reportes de solo lectura.

### Auditoría
- Toda acción sensible (login, cambios de estado, borrados, etc.) se registra en `audit_logs` y es consultable en `/api/v1/audit`.

## API (resumen)

- `POST /api/v1/auth/login`, `/refresh`, `/logout`, `GET /me`, `POST /change-password`
- CRUD: `/users`, `/students`, `/teachers`, `/careers`, `/subjects`, `/commissions`, `/enrollments`, `/classrooms`, `/schedules`, `/classes`
- Clases: `POST /classes/{id}/start`, `POST /classes/{id}/finish`, `POST /classes/{id}/qr`, `GET /classes/{id}/attendance`
- Asistencia: `POST /attendance/check-in`, `GET /attendance/me`, `PATCH /attendance/{id}/status`, `POST /attendance/justify`
- Reportes: `GET /reports/attendance`, `GET /reports/students/low-attendance`, `GET /reports/attendance/export?format=csv|xlsx`
- Auditoría: `GET /audit`
- WebSocket: `GET /api/v1/ws/classes/{class_id}?token=...` (eventos `checkin`, `pong`)
- Documentación interactiva: `GET /docs` (Swagger) al ejecutar el backend.

## Desarrollo local

### Backend (SQLite)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

export DATABASE_URL="sqlite:///./asistencia.db"   # o usa el default si tienes Postgres
python3 -m alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Tests

```bash
cd backend
rm -f test.db
python3 -m pytest tests -q        # 59 passed
```

### Frontend (dev server con proxy a `localhost:8000`)

```bash
cd frontend
npm install
npm start        # http://localhost:4200  (proxy.conf.json reenvía /api, incluido el WebSocket)
```

## Despliegue con Docker

```bash
cp .env.example .env
# Genera certificados TLS autofirmados (solo si no tenés certs reales):
mkdir -p certs
openssl req -x509 -nodes -newkey rsa:2048 -keyout certs/server.key \
    -out certs/server.crt -days 365 -subj "/CN=asistencia.local"

docker compose up -d --build
```

- Nginx sirve el frontend en `https://asistencia.local` (redirige HTTP → HTTPS).
- `/api/*` y `/ws/*` se proxean al backend; los WebSockets se actualizan en tiempo real.
- La primera vez, el backend ejecuta `alembic upgrade head` y siembra los roles y el usuario administrador definidos en `.env` (por defecto `admin@universidad.edu` / `Admin123!`).

> En producción: cambiá `JWT_SECRET_KEY`, usá certificados firmados por una CA y credenciales de administrador fuertes.

## Despliegue en Dokploy

El proyecto incluye `docker-compose.dokploy.yml` (Postgres, Redis, backend y frontend) y un nginx **solo HTTP** (`frontend/nginx.dokploy.conf` + `frontend/Dockerfile.dokploy`): en Dokploy el TLS/HTTPS y el dominio los resuelve su proxy inverso, no nginx.

### Pasos

1. **Subí el repositorio** a GitHub/GitLab/Bitbucket y conectalo en Dokploy.

2. **Creá el despliegue Compose** en Dokploy apuntando a `docker-compose.dokploy.yml` (o pegá su contenido).

3. **Configurá las variables de entorno** en la UI de Dokploy (son las mínimas obligatorias):
   - `JWT_SECRET_KEY` (¡generá una larga y aleatoria!)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_USERNAME`
   - `CORS_ORIGINS` → `https://tu-dominio.com`
   - `FRONTEND_PORT` (por defecto `8080`) y `BACKEND_PORT` (por defecto `8000`)

4. **Desplegá.** El backend ejecuta `alembic upgrade head` (crea las 17 tablas) y siembra roles + administrador. PostgreSQL y Redis persisten en volúmenes propios.

5. **Dominio y HTTPS con el proxy de Dokploy.** Creá un host en Nginx Proxy Manager (o adjuntá el dominio al servicio):
   - `tu-dominio.com` → forward a `127.0.0.1:${FRONTEND_PORT}` (ej. `8080`)
   - Habilitá **WebSocket Support** en el host y **Force SSL** con certificado **Let's Encrypt**.
   - No hace falta un subdominio de API: el nginx del frontend proxya `/api/v1/...` y el WebSocket al backend por la red de compose.

6. Entrá a `https://tu-dominio.com`, iniciá sesión con el admin y cargá carrera → materia → comisión → aulas → horarios → clases para usar el flujo completo (QR + GPS + WebSocket).

> Alternativa: si preferís subdominios separados, creá un host de NPM `api.tu-dominio.com` → `127.0.0.1:${BACKEND_PORT}` y dejá `CORS_ORIGINS` con ambos orígenes.
