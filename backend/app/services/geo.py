import math
from dataclasses import dataclass

from app.core.config import settings

EARTH_RADIUS_METERS = 6371000.0


@dataclass
class GeoValidation:
    valid: bool
    distance_meters: float
    reason: str | None = None


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en metros entre dos puntos (fórmula de Haversine)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(a))


def validate_gps(
    student_lat: float,
    student_lon: float,
    accuracy: float,
    classroom_lat: float,
    classroom_lon: float,
    radius_meters: float,
    max_accuracy: float | None = None,
) -> GeoValidation:
    """Valida precisión del GPS y distancia al aula."""
    if max_accuracy is None:
        max_accuracy = settings.GPS_MAX_ACCURACY

    if accuracy > max_accuracy:
        return GeoValidation(
            valid=False,
            distance_meters=0.0,
            reason=f"GPS_IMPRECISO",
        )

    distance = haversine(student_lat, student_lon, classroom_lat, classroom_lon)
    if distance > radius_meters:
        return GeoValidation(
            valid=False,
            distance_meters=distance,
            reason="FUERA_DEL_AULA",
        )
    return GeoValidation(valid=True, distance_meters=distance)
