import math

from app.services.geo import haversine, validate_gps


def test_haversine_same_point():
    assert haversine(0, 0, 0, 0) == 0.0


def test_haversine_known_distance():
    # Aproximadamente 111 km por grado de latitud
    d = haversine(0, 0, 1, 0)
    assert abs(d - 111194) < 500


def test_haversine_symmetry():
    a = haversine(10, 20, 30, 40)
    b = haversine(30, 40, 10, 20)
    assert abs(a - b) < 1e-6


def test_validate_inside_radius():
    result = validate_gps(-26.808285, -65.217590, 10.0, -26.808285, -65.217590, 100.0)
    assert result.valid is True
    assert result.distance_meters < 5


def test_validate_outside_radius():
    # ~1.1 km al norte del aula
    result = validate_gps(-26.798285, -65.217590, 10.0, -26.808285, -65.217590, 100.0)
    assert result.valid is False
    assert result.reason == "FUERA_DEL_AULA"


def test_validate_imprecise_accuracy():
    result = validate_gps(-26.808285, -65.217590, 120.0, -26.808285, -65.217590, 100.0, max_accuracy=25.0)
    assert result.valid is False
    assert result.reason == "GPS_IMPRECISO"


def test_validate_inside_border():
    # Dentro del radio (aula con radio 2000m)
    result = validate_gps(-26.808285, -65.217590, 8.0, -26.808285, -65.217590, 2000.0)
    assert result.valid is True
