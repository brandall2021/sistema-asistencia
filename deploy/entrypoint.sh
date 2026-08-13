#!/bin/sh
set -e

echo "[entrypoint] Esperando base de datos..."
python - <<'PY'
import os
import time
from urllib.parse import urlsplit

import sqlalchemy
from sqlalchemy import text
from sqlalchemy.engine import make_url

url = os.environ["DATABASE_URL"]
target = make_url(url)

# Espera a que el servidor PostgreSQL esté disponible (conectando a la BD de admin)
admin_url = target.set(database="postgres")
admin_engine = sqlalchemy.create_engine(admin_url)
for attempt in range(30):
    try:
        with admin_engine.connect():
            break
    except Exception:
        if attempt == 29:
            raise
        print(f"[entrypoint] PostgreSQL no listo (intento {attempt + 1}/30), reintentando...")
        time.sleep(2)
print("[entrypoint] PostgreSQL disponible.")

# Crea la base de datos del sistema si no existe
dbname = target.database
with admin_engine.connect() as conn:
    exists = conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": dbname}
    ).scalar()
    if not exists:
        conn.execute(text("COMMIT"))
        conn.execute(text(f'CREATE DATABASE "{dbname}"'))
        print(f"[entrypoint] Base de datos '{dbname}' creada.")
    else:
        print(f"[entrypoint] Base de datos '{dbname}' ya existe.")
admin_engine.dispose()
PY

echo "[entrypoint] Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Iniciando supervisord..."
exec supervisord -c /etc/supervisor/supervisord.conf
