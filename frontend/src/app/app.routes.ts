import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { ShellComponent } from './shared/shell/shell.component';
import { RoleName } from './core/models';
import { LoginComponent } from './views/login/login.component';
import { HomeComponent } from './views/home/home.component';
import { UsersComponent } from './views/admin/users/users.component';
import { StudentsComponent } from './views/admin/students/students.component';
import { TeachersComponent } from './views/admin/teachers/teachers.component';
import { CareersComponent } from './views/admin/careers/careers.component';
import { SubjectsComponent } from './views/admin/subjects/subjects.component';
import { CommissionsComponent } from './views/admin/commissions/commissions.component';
import { EnrollmentsComponent } from './views/admin/enrollments/enrollments.component';
import { ClassroomsComponent } from './views/admin/classrooms/classrooms.component';
import { SchedulesComponent } from './views/admin/schedules/schedules.component';
import { ClassesComponent } from './views/admin/classes/classes.component';
import { ClassDetailComponent } from './views/admin/classes/class-detail.component';
import { ReportsComponent } from './views/admin/reports/reports.component';
import { AuditComponent } from './views/admin/audit/audit.component';
import { ScanComponent } from './views/student/scan/scan.component';
import { HistoryComponent } from './views/student/history/history.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', component: HomeComponent },
      {
        path: 'admin/users',
        component: UsersComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/students',
        component: StudentsComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/teachers',
        component: TeachersComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/careers',
        component: CareersComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/subjects',
        component: SubjectsComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/commissions',
        component: CommissionsComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/enrollments',
        component: EnrollmentsComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/classrooms',
        component: ClassroomsComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/schedules',
        component: SchedulesComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'admin/classes',
        component: ClassesComponent,
        canActivate: [roleGuard(RoleName.ADMIN, RoleName.DOCENTE)],
      },
      {
        path: 'admin/classes/:id',
        component: ClassDetailComponent,
        canActivate: [roleGuard(RoleName.ADMIN, RoleName.DOCENTE)],
      },
      {
        path: 'admin/reports',
        component: ReportsComponent,
        canActivate: [roleGuard(RoleName.ADMIN, RoleName.AUDITOR)],
      },
      {
        path: 'admin/audit',
        component: AuditComponent,
        canActivate: [roleGuard(RoleName.ADMIN)],
      },
      {
        path: 'teacher/classes',
        component: ClassesComponent,
        canActivate: [roleGuard(RoleName.DOCENTE)],
      },
      {
        path: 'student/scan',
        component: ScanComponent,
        canActivate: [roleGuard(RoleName.ALUMNO)],
      },
      {
        path: 'student/history',
        component: HistoryComponent,
        canActivate: [roleGuard(RoleName.ALUMNO)],
      },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
