import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export type ChartType = 'bars' | 'line' | 'donut';

const DEFAULT_COLORS = [
  'var(--color-primary-600)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-info)',
];

interface BarShape {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  title: string;
}

interface StackedSegment {
  y: number;
  height: number;
  color: string;
  title: string;
}

interface StackedBar {
  x: number;
  width: number;
  segments: StackedSegment[];
}

interface LinePoint {
  x: number;
  y: number;
  label: string;
  value: number;
  color: string;
}

interface DonutSegment {
  dash: string;
  offset: number;
  color: string;
  label: string;
  value: number;
}

@Component({
  selector: 'app-simple-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="chart" [class.chart-animate]="animate">
      @switch (type) {
        @case ('line') {
          <svg
            role="img"
            [attr.aria-label]="ariaLabel"
            class="chart-svg"
            [attr.viewBox]="lineViewBox"
            preserveAspectRatio="none"
            width="100%"
            [attr.height]="height"
          >
            <defs>
              <linearGradient [attr.id]="gradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" [style.stop-color]="lineColor" [attr.stop-opacity]="'0.28'"></stop>
                <stop offset="100%" [style.stop-color]="lineColor" [attr.stop-opacity]="'0'"></stop>
              </linearGradient>
            </defs>
            @if (lineData.length > 1) {
              <polygon class="chart-area" [attr.points]="lineAreaPoints" [attr.fill]="'url(#' + gradId + ')'"></polygon>
              <polyline
                class="chart-line"
                [attr.points]="linePoints"
                fill="none"
                [style.stroke]="lineColor"
                stroke-width="2.5"
                vector-effect="non-scaling-stroke"
                [attr.pathLength]="1"
              ></polyline>
              <g>
                <circle class="chart-hit" *ngFor="let p of lineData" [attr.cx]="p.x" [attr.cy]="p.y" r="8">
                  <title>{{ p.label }}: {{ p.value }}</title>
                </circle>
              </g>
            } @else if (lineData.length === 1) {
              <circle class="chart-dot" [attr.cx]="lineData[0].x" [attr.cy]="lineData[0].y" r="4" [style.fill]="lineData[0].color">
                <title>{{ lineData[0].label }}: {{ lineData[0].value }}</title>
              </circle>
            }
          </svg>
        }
        @case ('donut') {
          <svg
            role="img"
            [attr.aria-label]="ariaLabel"
            class="chart-svg donut-svg"
            [attr.viewBox]="donutViewBox"
            width="100%"
            [attr.height]="donutSize"
          >
            <g [attr.transform]="donutRotate">
              <circle
                [attr.cx]="donutCenter"
                [attr.cy]="donutCenter"
                [attr.r]="donutRadius"
                fill="none"
                [style.stroke]="'var(--surface-muted)'"
                [attr.stroke-width]="20"
              ></circle>
              <circle
                class="chart-donut-seg"
                *ngFor="let s of donutSegments"
                [attr.cx]="donutCenter"
                [attr.cy]="donutCenter"
                [attr.r]="donutRadius"
                fill="none"
                [style.stroke]="s.color"
                [attr.stroke-width]="20"
                [attr.stroke-dasharray]="s.dash"
                [attr.stroke-dashoffset]="s.offset"
              >
                <title>{{ s.label }}: {{ s.value }}</title>
              </circle>
            </g>
          </svg>
          <div class="donut-legend" *ngIf="data.length">
            <div class="donut-legend-item" *ngFor="let s of donutSegments">
              <span class="donut-swatch" [style.background]="s.color"></span>
              <span class="donut-label">{{ s.label }}</span>
              <span class="donut-value">{{ s.value }}</span>
            </div>
          </div>
        }
        @case ('bars') {
          <svg
            role="img"
            [attr.aria-label]="ariaLabel"
            class="chart-svg"
            [attr.viewBox]="barViewBox"
            preserveAspectRatio="none"
            width="100%"
            [attr.height]="height"
          >
            <g *ngIf="!stacked">
              <rect
                class="bar"
                *ngFor="let b of barsShapes"
                [attr.x]="b.x"
                [attr.y]="b.y"
                [attr.width]="b.width"
                [attr.height]="b.height"
                rx="4"
                [style.fill]="b.color"
              >
                <title>{{ b.title }}</title>
              </rect>
            </g>
            <g *ngIf="stacked">
              <ng-container *ngFor="let bar of stackedBars">
                <rect
                  class="bar"
                  *ngFor="let s of bar.segments"
                  [attr.x]="bar.x"
                  [attr.y]="s.y"
                  [attr.width]="bar.width"
                  [attr.height]="s.height"
                  rx="2"
                  [style.fill]="s.color"
                >
                  <title>{{ s.title }}</title>
                </rect>
              </ng-container>
            </g>
          </svg>
        }
      }
    </div>
  `,
  styles: `
    .chart {
      width: 100%;
    }
    .chart-svg {
      display: block;
      width: 100%;
    }
    .donut-svg {
      max-height: 100%;
    }
    .donut-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-top: 12px;
    }
    .donut-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--fs-caption);
      color: var(--text-secondary);
    }
    .donut-swatch {
      flex: none;
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .donut-value {
      font-weight: 600;
      color: var(--text-primary);
    }
    .chart-animate .bar {
      transform-box: fill-box;
      transform-origin: center bottom;
      animation: chart-rise var(--dur-slow) var(--ease-out) both;
    }
    @keyframes chart-rise {
      from {
        transform: scaleY(0);
      }
    }
    .chart-animate .chart-area {
      opacity: 0;
      animation: chart-fade var(--dur-slow) var(--ease-out) forwards;
    }
    .chart-animate .chart-line {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: chart-draw var(--dur-slow) var(--ease-out) forwards;
    }
    @keyframes chart-draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    .chart-animate .chart-donut-seg {
      opacity: 0;
      animation: chart-fade var(--dur-slow) var(--ease-out) both;
    }
    @keyframes chart-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
})
export class SimpleChartComponent {
  @Input() type: ChartType = 'bars';
  @Input() data: ChartDatum[] = [];
  @Input() height = 220;
  @Input() stacked = false;
  @Input() ariaLabel = 'Gráfico';

  private static uid = 0;
  readonly gradId = `simple-chart-grad-${++SimpleChartComponent.uid}`;

  private readonly pad = 8;
  private readonly padLine = 16;
  private readonly stroke = 20;

  get animate(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  color(index: number, datum?: ChartDatum): string {
    return datum?.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  }

  get barMax(): number {
    if (this.stacked) {
      return Math.max(1, ...this.stackedGroups.map((g) => g.total));
    }
    return Math.max(1, ...this.data.map((d) => d.value));
  }

  get barChartWidth(): number {
    const n = this.stacked ? this.stackedGroups.length : this.data.length;
    return Math.max(240, n * 56);
  }

  get barViewBox(): string {
    return `0 0 ${this.barChartWidth} ${this.height}`;
  }

  get stackedGroups(): { label: string; total: number }[] {
    const groups: { label: string; total: number }[] = [];
    for (const d of this.data) {
      const existing = groups.find((g) => g.label === d.label);
      if (existing) {
        existing.total += d.value;
      } else {
        groups.push({ label: d.label, total: d.value });
      }
    }
    return groups;
  }

  get barsShapes(): BarShape[] {
    const n = this.data.length;
    const plotH = this.height - this.pad * 2;
    const slot = (this.barChartWidth - this.pad * 2) / n;
    const bw = Math.max(4, Math.min(64, slot * 0.62));
    const max = this.barMax;
    return this.data.map((d, i) => {
      const h = max > 0 ? (d.value / max) * plotH : 0;
      return {
        x: this.pad + i * slot + (slot - bw) / 2,
        y: this.pad + plotH - h,
        width: bw,
        height: h,
        color: this.color(i, d),
        title: `${d.label}: ${d.value}`,
      };
    });
  }

  get stackedBars(): StackedBar[] {
    const groups = this.stackedGroups;
    const n = groups.length;
    const plotH = this.height - this.pad * 2;
    const slot = (this.barChartWidth - this.pad * 2) / n;
    const bw = Math.max(4, Math.min(64, slot * 0.62));
    const max = this.barMax;
    const shapes: StackedBar[] = [];
    let groupIndex = 0;
    for (const group of groups) {
      const segments: StackedSegment[] = [];
      const groupData = this.data.filter((d) => d.label === group.label);
      let cum = 0;
      groupData.forEach((d, i) => {
        const h = (d.value / max) * plotH;
        segments.push({
          y: this.pad + plotH - cum - h,
          height: h,
          color: this.color(i, d),
          title: `${d.label}: ${d.value}`,
        });
        cum += h;
      });
      shapes.push({
        x: this.pad + groupIndex * slot + (slot - bw) / 2,
        width: bw,
        segments,
      });
      groupIndex++;
    }
    return shapes;
  }

  get lineChartWidth(): number {
    return Math.max(240, this.data.length * 56);
  }

  get lineViewBox(): string {
    return `0 0 ${this.lineChartWidth} ${this.height}`;
  }

  get lineData(): LinePoint[] {
    const n = this.data.length;
    const plotH = this.height - this.padLine * 2;
    const max = Math.max(1, ...this.data.map((d) => d.value));
    return this.data.map((d, i) => ({
      x: n === 1 ? this.lineChartWidth / 2 : this.padLine + (i * (this.lineChartWidth - this.padLine * 2)) / (n - 1),
      y: this.padLine + plotH - (d.value / max) * plotH,
      label: d.label,
      value: d.value,
      color: this.color(i, d),
    }));
  }

  get linePoints(): string {
    return this.lineData.map((p) => `${p.x},${p.y}`).join(' ');
  }

  get lineAreaPoints(): string {
    const pts = this.lineData;
    if (!pts.length) {
      return '';
    }
    const bottom = this.height - this.padLine;
    return `${this.linePoints} ${pts[pts.length - 1].x},${bottom} ${pts[0].x},${bottom}`;
  }

  get lineColor(): string {
    return this.data.length ? this.color(0, this.data[0]) : DEFAULT_COLORS[0];
  }

  get donutRadius(): number {
    return Math.max(40, Math.min(110, this.height / 2 - 24));
  }

  get donutSize(): number {
    return this.donutRadius * 2 + 8;
  }

  get donutCenter(): number {
    return this.donutRadius + 4;
  }

  get donutViewBox(): string {
    return `0 0 ${this.donutSize} ${this.donutSize}`;
  }

  get donutRotate(): string {
    return `rotate(-90 ${this.donutCenter} ${this.donutCenter})`;
  }

  get donutSegments(): DonutSegment[] {
    const total = this.data.reduce((sum, d) => sum + d.value, 0);
    const circumference = 2 * Math.PI * this.donutRadius;
    let acc = 0;
    return this.data.map((d, i) => {
      const len = total > 0 ? (d.value / total) * circumference : 0;
      const seg: DonutSegment = {
        dash: `${len} ${circumference - len}`,
        offset: -acc,
        color: this.color(i, d),
        label: d.label,
        value: d.value,
      };
      acc += len;
      return seg;
    });
  }
}
