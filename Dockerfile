# ==========================================================================
# Imagen única para Dokploy (Application / Dockerfile)
#   - Build del frontend Angular -> estáticos servidos por Nginx.
#   - Backend FastAPI (uvicorn) en el mismo contenedor, en 127.0.0.1:8000.
#   - Nginx hace proxy de /api/v1/... y WebSocket al uvicorn local.
#   - Postgres y Redis se provisionan como servicios externos en Dokploy;
#     se conectan via DATABASE_URL y REDIS_URL (variables de entorno).
# ==========================================================================

# --- Etapa 1: build del frontend -----------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build -- --configuration=production

# --- Etapa 2: dependencias del backend ------------------------------------
FROM python:3.12-slim AS backend-deps
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /opt/backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Etapa 3: imagen de runtime -------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# Backend (código + dependencias de la etapa 2, incluidos binarios como alembic/uvicorn)
COPY --from=backend-deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=backend-deps /usr/local/bin/uvicorn /usr/local/bin/alembic /usr/local/bin/
WORKDIR /opt/backend
COPY backend/ .

# Frontend compilado
COPY --from=frontend-build /build/dist/frontend/browser /usr/share/nginx/html

# Servicios: nginx (SPA + proxy), supervisord (uvicorn + nginx)
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/conf.d/app.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
    CMD curl -fsS http://127.0.0.1/health || exit 1

CMD ["/entrypoint.sh"]
