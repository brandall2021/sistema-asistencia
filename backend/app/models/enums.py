from enum import Enum


class RoleName(str, Enum):
    ADMIN = "ADMIN"
    DOCENTE = "DOCENTE"
    ALUMNO = "ALUMNO"
    AUDITOR = "AUDITOR"


class ClassStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    FINISHED = "FINISHED"
    CANCELLED = "CANCELLED"


class AttendanceStatus(str, Enum):
    PRESENT = "PRESENT"
    LATE = "LATE"
    ABSENT = "ABSENT"
    JUSTIFIED = "JUSTIFIED"
    REVIEW = "REVIEW"
    REJECTED = "REJECTED"


class JustificationStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class EnrollmentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class CheckInMethod(str, Enum):
    QR = "QR"
    MANUAL = "MANUAL"
