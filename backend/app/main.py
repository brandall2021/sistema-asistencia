from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.seed import seed
from app.db.session import SessionLocal, engine
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.DATABASE_URL.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Sistema de gestión de asistencia universitaria con QR dinámico, "
        "geolocalización GPS y control horario."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=settings.APP_NAME,
        version="1.0.0",
        description=app.description,
        routes=app.routes,
    )
    schema["components"]["securitySchemes"] = {
        "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    for path in schema["paths"].values():
        for operation in path.values():
            if "security" not in operation and operation.get("operationId"):
                operation["security"] = [{"bearerAuth": []}]
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["System"])
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": "1.0.0"}
