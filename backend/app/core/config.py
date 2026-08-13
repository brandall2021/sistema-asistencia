from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Sistema de Asistencia Universitaria"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    DATABASE_URL: str = (
        "postgresql+psycopg2://asistencia:asistencia@localhost:5432/asistencia"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "change-me-in-production-please-use-a-long-random-value"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "sistema-asistencia-universitaria"

    QR_TOKEN_TTL_SECONDS: int = 45
    GPS_MAX_ACCURACY: float = 25.0
    LATE_GRACE_MINUTES: int = 10

    RATE_LIMIT_LOGIN: int = 10
    RATE_LIMIT_PERIOD_SECONDS: int = 300
    RATE_LIMIT_CHECKIN: int = 5
    RATE_LIMIT_DEFAULT: int = 120

    CORS_ORIGINS: str = "http://localhost:4200,http://localhost:4201,https://asistencia.local"

    ADMIN_EMAIL: str = "admin@universidad.edu"
    ADMIN_USERNAME: str = "admin"
    ADMIN_FULL_NAME: str = "Administrador del Sistema"
    ADMIN_PASSWORD: str = "Admin123!"

    WEBSOCKET_NOTIFY_CHANNEL: str = "attendance:notify"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
