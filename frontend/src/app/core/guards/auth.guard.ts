import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RoleName } from '../models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

function homeFor(auth: AuthService): string {
  if (auth.hasAnyRole(RoleName.ADMIN)) {
    return '/admin/users';
  }
  if (auth.hasAnyRole(RoleName.DOCENTE)) {
    return '/teacher/classes';
  }
  if (auth.hasAnyRole(RoleName.AUDITOR)) {
    return '/admin/reports';
  }
  return '/student/scan';
}

export function roleGuard(...roles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (auth.hasAnyRole(...roles)) {
      return true;
    }
    return router.createUrlTree([homeFor(auth)]);
  };
}
