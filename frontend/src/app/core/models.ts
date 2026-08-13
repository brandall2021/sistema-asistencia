export enum RoleName {
  ADMIN = 'ADMIN',
  DOCENTE = 'DOCENTE',
  ALUMNO = 'ALUMNO',
  AUDITOR = 'AUDITOR',
}

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  roles: RoleName[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Career {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  career_id: string;
  career_name: string;
  semester: number;
  credits: number;
  active: boolean;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string;
  employee_number: string;
  title: string;
  department: string;
  full_name: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  registration_number: string;
  dni: string;
  career_id: string;
  career_name: string;
  year: number;
  full_name: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface Commission {
  id: string;
  name: string;
  code: string;
  subject_id: string;
  subject_name: string;
  career_id: string;
  career_name: string;
  teacher_id: string;
  teacher_name: string;
  year: number;
  period: string;
  capacity: number;
  active: boolean;
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  commission_id: string;
  commission_name: string;
  subject_name: string;
  career_name: string;
  status: string;
  enrolled_at: string;
  student_full_name: string;
  registration_number: string;
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
  created_at: string;
}

export interface Schedule {
  id: string;
  commission_id: string;
  commission_name: string;
  subject_name: string;
  classroom_id: string;
  classroom_name: string;
  classroom_code: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

export enum ClassStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export interface ClassSession {
  id: string;
  commission_id: string;
  commission_name: string;
  subject_name: string;
  career_name: string;
  schedule_id: string;
  classroom_id: string;
  classroom_name: string;
  classroom_code: string;
  teacher_id: string;
  teacher_name: string;
  created_by: string;
  title: string;
  date: string;
  starts_at: string;
  ends_at: string;
  status: ClassStatus;
  late_grace_minutes: number;
  attendance_count: number;
  total_students: number;
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  JUSTIFIED = 'JUSTIFIED',
  REVIEW = 'REVIEW',
  REJECTED = 'REJECTED',
}

export interface Attendance {
  id: string;
  class_id: string;
  class_title: string;
  subject_name: string;
  commission_name: string;
  date: string;
  student_id: string;
  student_name: string;
  registration_number: string;
  status: AttendanceStatus;
  check_in_at: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  distance_meters: number;
  method: string;
  review_reason: string;
}

export interface CheckInResponse {
  success: boolean;
  status: string;
  message: string;
  attendance: Attendance | null;
}

export interface Justification {
  id: string;
  attendance_id: string;
  student_id: string;
  reason: string;
  document_url: string;
  status: string;
  review_notes: string;
}

export interface AuditLog {
  id: string;
  username: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

export interface QRData {
  token: string;
  class_id: string;
  expires_at: string;
  ttl_seconds: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface WSEvent {
  event: 'pong' | 'checkin' | 'class-started' | 'checkin_confirmed' | 'class-update' | 'error';
  detail?: string;
  data?: Attendance | ClassSession | Record<string, unknown>;
}

export interface UpcomingClass {
  id: string;
  title: string;
  subject: string;
  commission: string;
  classroom?: string | null;
  date: string;
  starts_at?: string | null;
  status: string;
}

export interface RecentAttendance {
  id: string;
  student_name: string;
  class_title: string;
  date: string;
  status: string;
  check_in_at?: string | null;
}

export interface SubjectRisk {
  subject: string;
  commission: string;
  attendance_pct: number;
}

export interface AuditEventBrief {
  id: string;
  action: string;
  username?: string | null;
  created_at: string;
}

export interface DashboardSummary {
  classes_today: number;
  active_classes: number;
  attendance_rate_today?: number | null;
  pending_justifications: number;
  low_attendance_students: number;
  upcoming_classes: UpcomingClass[];
  next_class?: UpcomingClass | null;
  recent_attendance: RecentAttendance[];
  subjects_at_risk: SubjectRisk[];
  recent_audit: AuditEventBrief[];
}
