import { RoleName } from '../core/models';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  ACTIVE_CLASS: 'En curso',
  INACTIVE: 'Inactiva',
  SCHEDULED: 'Programada',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  PRESENT: 'Presente',
  LATE: 'Tarde',
  ABSENT: 'Ausente',
  JUSTIFIED: 'Justificada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
  REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
};

export const STATUS_TONES: Record<string, StatusTone> = {
  PRESENT: 'success',
  APPROVED: 'success',
  ACTIVE: 'success',
  ACTIVE_CLASS: 'success',
  LATE: 'warning',
  PENDING: 'warning',
  INACTIVE: 'warning',
  ABSENT: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
  SCHEDULED: 'primary',
  JUSTIFIED: 'info',
  REVIEW: 'warning',
  FINISHED: 'neutral',
};

export const ROLE_LABELS: Record<RoleName, string> = {
  [RoleName.ADMIN]: 'Administrador',
  [RoleName.DOCENTE]: 'Docente',
  [RoleName.ALUMNO]: 'Alumno',
  [RoleName.AUDITOR]: 'Auditor',
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status ?? ''] ?? 'neutral';
}

export function statusLabel(status: string, kind?: 'class'): string {
  const key = kind === 'class' && status === 'ACTIVE' ? 'ACTIVE_CLASS' : (status ?? '');
  return STATUS_LABELS[key] ?? status;
}

export function statusClass(status: string): string {
  return statusTone(status);
}
