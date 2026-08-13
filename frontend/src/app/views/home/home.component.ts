import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { RoleName } from '../../core/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="center">
      <mat-spinner diameter="32"></mat-spinner>
    </div>
  `,
  styles: `
    .center { display: flex; justify-content: center; padding: 48px; }
  `,
})
export class HomeComponent implements OnInit {
  constructor(private router: Router, private auth: AuthService) {}

  ngOnInit(): void {
    this.router.navigate([this.home()], { replaceUrl: true });
  }

  private home(): string {
    if (this.auth.hasAnyRole(RoleName.ADMIN)) {
      return '/admin/users';
    }
    if (this.auth.hasAnyRole(RoleName.DOCENTE)) {
      return '/teacher/classes';
    }
    if (this.auth.hasAnyRole(RoleName.AUDITOR)) {
      return '/admin/reports';
    }
    return '/student/scan';
  }
}
