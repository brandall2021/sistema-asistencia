import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Attendance, AttendanceStatus, DashboardSummary, Page } from '../models';
import { ChartDatum } from '../../shared/components/simple-chart/simple-chart.component';

export type PeriodKey = 'today' | 'week' | 'month';

export interface AttendanceReportItem {
  student_id: string;
  registration_number?: string | null;
  student_name?: string | null;
  total_classes: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  review: number;
  attendance_rate: number;
}

export interface SeriesData {
  evolution: ChartDatum[];
  distribution: ChartDatum[];
}

export interface ReportFilters extends Record<string, string | number | boolean | undefined | null> {
  commission_id?: string;
  career_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface StudentStats {
  overall: number;
  perSubject: { subject: string; pct: number }[];
}

interface WindowSpec {
  from: Date;
  to: Date;
  label: string;
}

const EMPTY_SUMMARY: DashboardSummary = {
  classes_today: 0,
  active_classes: 0,
  attendance_rate_today: null,
  pending_justifications: 0,
  low_attendance_students: 0,
  upcoming_classes: [],
  next_class: null,
  recent_attendance: [],
  subjects_at_risk: [],
  recent_audit: [],
};

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private api: ApiService) {}

  async loadSummary(): Promise<DashboardSummary> {
    try {
      return await this.api.get<DashboardSummary>('/dashboard/summary');
    } catch {
      return { ...EMPTY_SUMMARY };
    }
  }

  async loadLowAttendance(filters: ReportFilters = {}): Promise<AttendanceReportItem[]> {
    try {
      return await this.api.get<AttendanceReportItem[]>('/reports/students/low-attendance', filters);
    } catch {
      return [];
    }
  }

  async loadAttendanceReport(filters: ReportFilters = {}): Promise<AttendanceReportItem[]> {
    try {
      return await this.api.get<AttendanceReportItem[]>('/reports/attendance', {
        dimension: 'student',
        ...filters,
      });
    } catch {
      return [];
    }
  }

  async loadSeries(period: PeriodKey, filters: ReportFilters = {}): Promise<SeriesData> {
    try {
      return await this.loadSeriesForWindows(this.windowsFor(period), filters);
    } catch {
      return { evolution: [], distribution: [] };
    }
  }

  async loadSeriesRange(filters: ReportFilters = {}): Promise<SeriesData> {
    try {
      const from = this.parseDate(filters.from_date);
      const to = this.parseDate(filters.to_date);

      if (!from || !to) {
        return await this.loadSeries('month', filters);
      }

      return await this.loadSeriesForWindows(this.windowsForRange(from, to), filters);
    } catch {
      return { evolution: [], distribution: [] };
    }
  }

  async loadStudentStats(): Promise<StudentStats> {
    try {
      const res = await this.api.get<Attendance[] | Page<Attendance>>('/attendance/me');
      const items = Array.isArray(res) ? res : res?.items ?? [];
      const bySubject = new Map<string, { present: number; late: number; justified: number; absent: number }>();
      const totals = { present: 0, late: 0, justified: 0, absent: 0 };

      for (const r of items) {
        const key = this.subjectKey(r);
        const entry = bySubject.get(key) ?? { present: 0, late: 0, justified: 0, absent: 0 };
        if (r.status === AttendanceStatus.PRESENT) {
          entry.present++;
          totals.present++;
        } else if (r.status === AttendanceStatus.LATE) {
          entry.late++;
          totals.late++;
        } else if (r.status === AttendanceStatus.JUSTIFIED) {
          entry.justified++;
          totals.justified++;
        } else {
          entry.absent++;
          totals.absent++;
        }
        bySubject.set(key, entry);
      }

      const overallTotal = totals.present + totals.late + totals.justified + totals.absent;
      const overall = overallTotal > 0 ? Math.round(((totals.present + totals.late + totals.justified) / overallTotal) * 100) : 0;

      const perSubject = Array.from(bySubject.entries()).map(([subject, c]) => {
        const total = c.present + c.late + c.justified + c.absent;
        return {
          subject,
          pct: total > 0 ? Math.round(((c.present + c.late + c.justified) / total) * 100) : 0,
        };
      });

      return { overall, perSubject };
    } catch {
      return { overall: 0, perSubject: [] };
    }
  }

  private subjectKey(record: Attendance): string {
    return record.subject_name || record.class_title || 'General';
  }

  private windowsFor(period: PeriodKey): WindowSpec[] {
    const today = new Date();
    if (period === 'today') {
      return [{ from: today, to: today, label: 'Hoy' }];
    }
    const monday = this.startOfWeek(today);
    if (period === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { from: d, to: d, label: `${DAY_NAMES[d.getDay()]} ${this.dayMonth(d)}` };
      });
    }
    return Array.from({ length: 5 }, (_, i) => {
      const from = new Date(monday);
      from.setDate(monday.getDate() - (4 - i) * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return {
        from,
        to,
        label: `${this.dayMonth(from)}–${this.dayMonth(to)}`,
      };
    });
  }

  private windowsForRange(from: Date, to: Date): WindowSpec[] {
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

    if (days <= 14) {
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return { from: d, to: d, label: `${DAY_NAMES[d.getDay()]} ${this.dayMonth(d)}` };
      });
    }

    const out: WindowSpec[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      const fromWindow = new Date(cursor);
      const toWindow = new Date(cursor);
      toWindow.setDate(cursor.getDate() + 6);
      if (toWindow > end) {
        toWindow.setTime(end.getTime());
      }
      out.push({ from: fromWindow, to: toWindow, label: `${this.dayMonth(fromWindow)}–${this.dayMonth(toWindow)}` });
      cursor = new Date(toWindow);
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  private async loadSeriesForWindows(windows: WindowSpec[], filters: ReportFilters): Promise<SeriesData> {
    const rows = await Promise.all(
      windows.map((w) =>
        this.api.get<AttendanceReportItem[]>('/reports/attendance', {
          dimension: 'student',
          ...filters,
          from_date: this.fmtDate(w.from),
          to_date: this.fmtDate(w.to),
        }),
      ),
    );

    const evolution: ChartDatum[] = windows.map((w, i) => ({
      label: w.label,
      value: rows[i].reduce((sum, r) => sum + r.present + r.late + r.justified + r.absent, 0),
    }));

    const distribution: ChartDatum[] = [
      { label: 'Presente', value: this.sumStatus(rows, 'present') },
      { label: 'Tarde', value: this.sumStatus(rows, 'late') },
      { label: 'Ausente', value: this.sumStatus(rows, 'absent') },
      { label: 'Justificada', value: this.sumStatus(rows, 'justified') },
    ];

    return { evolution, distribution };
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private startOfWeek(d: Date): Date {
    const out = new Date(d);
    out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
    out.setHours(0, 0, 0, 0);
    return out;
  }

  private dayMonth(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private sumStatus(
    rows: AttendanceReportItem[][],
    key: 'present' | 'late' | 'absent' | 'justified',
  ): number {
    return rows.reduce((sum, row) => sum + row.reduce((s, r) => s + r[key], 0), 0);
  }
}
