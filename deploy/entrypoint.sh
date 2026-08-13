#!/bin/sh
set -e

echo "[entrypoint] Esperando base de datos..."
python - <<'PY'
import os
import time

import sqlalchemy

url = os.environ["DATABASE_URL"]
engine = sqlalchemy.create_engine(url)
for attempt in range(30):
    try:
        with engine.connect():
            break
    except Exception:
        if attempt == 29:
            raise
        print(f"[entrypoint] BD no lista (intento {attempt + 1}/30), reintentando...")
        time.sleep(2)
print("[entrypoint] Base de datos disponible.")
PY

echo "[entrypoint] Aplicando migraciones (alembic upgrade head)..."
alembic upgrade head

echo "[entrypoint] Iniciando supervisord..."
exec supervisord -c /etc/supervisor/supervisord.conf
