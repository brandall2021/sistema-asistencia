from functools import lru_cache
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "change-me-in-production-please-use-a-long-random-value"


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

    JWT_SECRET_KEY: str = _DEFAULT_JWT_SECRET
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

    # Proxies confiables (IP o CIDR separados por coma). Solo desde estas IPs se
    # acepta X-Forwarded-For para el rate limiting.
    TRUSTED_PROXIES: str = ""

    # Cookie HttpOnly del refresh token
    REFRESH_COOKIE_NAME: str = "refresh_token"
    REFRESH_COOKIE_SECURE: bool = False
    REFRESH_COOKIE_SAMESITE: str = "lax"
    REFRESH_COOKIE_DOMAIN: str | None = None
    REFRESH_COOKIE_PATH: str = "/api/v1/auth"

    # Ticket de un solo uso para WebSocket
    WS_TICKET_TTL_SECONDS: int = 30

    CORS_ORIGINS: str = "http://localhost:4200,http://localhost:4201,https://asistencia.local"

    ADMIN_EMAIL: str = "admin@universidad.edu"
    ADMIN_USERNAME: str = "admin"
    ADMIN_FULL_NAME: str = "Administrador del Sistema"
    ADMIN_PASSWORD: str = "Admin123!"

    WEBSOCKET_NOTIFY_CHANNEL: str = "attendance:notify"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def trusted_proxy_list(self) -> list[str]:
        return [p.strip() for p in self.TRUSTED_PROXIES.split(",") if p.strip()]

    def validate_production(self) -> None:
        """Niega el arranque en producción si la configuración es insegura.

        Los mensajes describen el problema sin exponer el valor de los secretos.
        """
        if self.APP_ENV != "production":
            return
        errors: list[str] = []
        if self.JWT_SECRET_KEY == _DEFAULT_JWT_SECRET:
            errors.append("JWT_SECRET_KEY conserva el valor predeterminado")
        if len(self.JWT_SECRET_KEY.encode("utf-8")) < 32:
            errors.append("JWT_SECRET_KEY debe tener al menos 32 bytes")
        if self.ADMIN_PASSWORD == "Admin123!":
            errors.append("ADMIN_PASSWORD conserva el valor predeterminado")
        password = urlparse(self.DATABASE_URL).password
        if password == "asistencia":
            errors.append("La contraseña de PostgreSQL conserva el valor predeterminado")
        for origin in self.cors_origin_list:
            if origin == "*" or "localhost" in origin:
                errors.append(
                    "CORS_ORIGINS no puede contener comodines ni localhost en producción"
                )
                break
        if errors:
            raise RuntimeError("Configuración de producción insegura: " + "; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
