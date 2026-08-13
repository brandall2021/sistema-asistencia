import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private router: Router) {}

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  setTokens(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setUser(user: unknown): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  getUser(): any {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  get roles(): string[] {
    const u = this.getUser();
    return u?.roles ?? [];
  }

  hasAnyRole(...roles: string[]): boolean {
    return this.roles.some((r) => roles.includes(r));
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.router.navigate(['/login']);
  }
}
