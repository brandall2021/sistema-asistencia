import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const KEY = 'sau.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private dark$ = new BehaviorSubject<boolean>(false);
  readonly isDark$ = this.dark$.asObservable();

  constructor() {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark') this.dark$.next(true);
    else if (stored === 'light') this.dark$.next(false);
    else this.dark$.next(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
    this.apply();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(KEY)) {
        this.dark$.next(e.matches);
        this.apply();
      }
    });
  }

  get isDark(): boolean { return this.dark$.value; }

  toggle(): void { this.setDark(!this.isDark); }

  setDark(v: boolean): void {
    this.dark$.next(v);
    localStorage.setItem(KEY, v ? 'dark' : 'light');
    this.apply();
  }

  private apply(): void {
    document.documentElement.setAttribute('data-theme', this.isDark ? 'dark' : 'light');
  }
}
