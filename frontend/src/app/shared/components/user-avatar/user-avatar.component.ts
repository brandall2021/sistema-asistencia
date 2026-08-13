import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

const AVATAR_TONES = 6;

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <span
      class="avatar avatar-{{ toneIndex }}"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.font-size.px]="size * 0.4"
      aria-hidden="true">
      {{ initials }}
    </span>
  `,
  styles: `
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: 600;
      line-height: 1;
      user-select: none;
      flex: none;
    }
    .avatar-0 { background: color-mix(in srgb, var(--color-primary-500) 16%, transparent); color: var(--color-primary-600); }
    .avatar-1 { background: color-mix(in srgb, var(--color-info) 16%, transparent); color: var(--color-info); }
    .avatar-2 { background: color-mix(in srgb, var(--color-success) 16%, transparent); color: var(--color-success); }
    .avatar-3 { background: color-mix(in srgb, var(--color-warning) 18%, transparent); color: var(--color-warning); }
    .avatar-4 { background: color-mix(in srgb, var(--color-danger) 16%, transparent); color: var(--color-danger); }
    .avatar-5 { background: color-mix(in srgb, var(--text-secondary) 16%, transparent); color: var(--text-secondary); }
  `,
})
export class UserAvatarComponent {
  @Input() name = '';
  @Input() size = 36;

  get initials(): string {
    const words = this.name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return '?';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  get toneIndex(): number {
    return this.hash(this.name) % AVATAR_TONES;
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}
