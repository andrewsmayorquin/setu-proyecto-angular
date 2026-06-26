import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { toSignal } from '@angular/core/rxjs-interop';
import { EvaluationsService } from '../../services/evaluations.service';
import { EvaluatorsService } from '../../services/evaluators.service';
import { StudentsService } from '../../services/students.service';
import { TeamsService } from '../../services/teams.service';
import { SidebarComponent } from '../sidebar/sidebar';

interface ResultRow {
  id?: string;
  teamId: string;
  teamName: string;
  studentId: string;
  studentName: string;
  /** Scores per evaluator: { evaluatorName, score100, scoreFinal } */
  evaluatorScores: { name: string; score100: number; scoreFinal: number }[];
  /** Average of all evaluators' 0–100 scores. */
  average100: number;
  /** Final grade after applying terna weight. */
  finalGrade: number;
  /** Terna weight used for this row. */
  weight: number;
  evaluatorsCount: number;
  completionLabel: string;
}

@Component({
  selector: 'app-resultados',
  templateUrl: './resultados.html',
  styleUrl: './resultados.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent],
  animations: [
    trigger('fadeList', [
      transition(':enter', [
        query('.stat-card, .top-card, .chart-card, .table-card', [
          style({ opacity: 0, transform: 'translateY(14px)' }),
          stagger(70, animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })))
        ], { optional: true })
      ])
    ])
  ]
})
export class ResultadosComponent {
  private readonly evaluationsService = inject(EvaluationsService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly studentsService = inject(StudentsService);
  private readonly teamsService = inject(TeamsService);

  readonly pageSize = signal(10);
  readonly currentPage = signal(1);
  readonly filterTeamId = signal('');

  private readonly evaluationsSignal = toSignal(this.evaluationsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });

  readonly lastUpdated = computed(() =>
    new Date().toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short' })
  );

  readonly teams = computed(() => this.teamsSignal());

  /** Full result matrix: one row per (student, terna) pair. */
  readonly results = computed((): ResultRow[] => {
    const evals = this.evaluationsSignal().filter(e => e.status === 'submitted');
    const students = this.studentsSignal();
    const evaluators = this.evaluatorsSignal();
    const teams = this.teamsSignal();

    // Group evaluations by (ternaId, studentId)
    const grouped = new Map<string, typeof evals>();
    for (const ev of evals) {
      const key = `${ev.ternaId}__${ev.studentId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ev);
    }

    const rows: ResultRow[] = [];

    for (const [key, evGroup] of grouped) {
      const [ternaId, studentId] = key.split('__');
      const team = teams.find(t => t.id === ternaId);
      const student = students.find(s => s.id === studentId);
      if (!team || !student) continue;

      const weight = team.weight ?? 40;

      const evaluatorScores = evGroup.map(ev => {
        const name = evaluators.find(e => e.id === ev.evaluatorId)?.name ?? ev.evaluatorId;
        const scoreFinal = Math.round(ev.totalScore * weight / 100);
        return { name, score100: ev.totalScore, scoreFinal };
      });

      const average100 = evaluatorScores.length > 0
        ? Math.round(evaluatorScores.reduce((s, e) => s + e.score100, 0) / evaluatorScores.length)
        : 0;

      const finalGrade = Math.round(average100 * weight / 100);

      rows.push({
        teamId: ternaId,
        teamName: team.name,
        studentId,
        studentName: student.name,
        evaluatorScores,
        average100,
        finalGrade,
        weight,
        evaluatorsCount: evaluatorScores.length,
        completionLabel: `${evaluatorScores.length}/${team.evaluatorIds.length} evaluadores`
      });
    }

    return rows.sort((a, b) => b.finalGrade - a.finalGrade);
  });

  readonly filteredResults = computed(() => {
    const tid = this.filterTeamId();
    return tid ? this.results().filter(r => r.teamId === tid) : this.results();
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredResults().length / this.pageSize()))
  );

  readonly paginatedResults = computed(() => {
    const safePage = Math.min(this.currentPage(), this.totalPages());
    const start = (safePage - 1) * this.pageSize();
    return this.filteredResults().slice(start, start + this.pageSize());
  });

  readonly topTheses = computed(() =>
    this.results().filter(r => r.finalGrade > 0).slice(0, 3)
  );

  readonly averageScore = computed(() => {
    const rows = this.results();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((s, r) => s + r.finalGrade, 0) / rows.length);
  });

  /** Maximum weight across all ternas (for label). */
  readonly maxWeight = computed(() =>
    Math.max(0, ...this.teamsSignal().map(t => t.weight ?? 40))
  );

  readonly completedPercentage = computed(() => {
    const teams = this.teamsSignal();
    if (!teams.length) return 0;
    const complete = teams.filter(t => t.status === 'completed').length;
    return Math.round((complete / teams.length) * 100);
  });

  readonly reportsCount = computed(() => this.results().length);

  readonly cycleStats = computed(() => {
    const counts = new Map<string, number>();
    for (const team of this.teamsSignal()) {
      if (!team.date) continue;
      const year = team.date.slice(0, 4);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => Number(a.year) - Number(b.year));
    const max = Math.max(1, ...entries.map(e => e.count));
    return entries.map(e => ({ ...e, height: Math.round((e.count / max) * 100) }));
  });

  readonly scoreDistribution = computed(() => {
    const w = this.maxWeight() || 40;
    const q1 = Math.round(w * 0.5);
    const q2 = Math.round(w * 0.75);
    const q3 = Math.round(w * 0.9);
    const buckets = [
      { label: `0–${q1}`, count: 0 },
      { label: `${q1 + 1}–${q2}`, count: 0 },
      { label: `${q2 + 1}–${q3}`, count: 0 },
      { label: `${q3 + 1}–${w}`, count: 0 }
    ];
    for (const r of this.results()) {
      if (r.finalGrade <= q1) buckets[0].count++;
      else if (r.finalGrade <= q2) buckets[1].count++;
      else if (r.finalGrade <= q3) buckets[2].count++;
      else buckets[3].count++;
    }
    const max = Math.max(1, ...buckets.map(b => b.count));
    return buckets.map(b => ({ ...b, height: Math.round((b.count / max) * 100) }));
  });

  /** Per-evaluator stats for the report. */
  readonly evaluatorStats = computed(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const row of this.results()) {
      for (const es of row.evaluatorScores) {
        if (!map.has(es.name)) map.set(es.name, { name: es.name, count: 0, total: 0 });
        const entry = map.get(es.name)!;
        entry.count++;
        entry.total += es.score100;
      }
    }
    return Array.from(map.values()).map(e => ({
      name: e.name,
      count: e.count,
      average: e.count > 0 ? Math.round(e.total / e.count) : 0
    }));
  });

  setFilterTeam(id: string): void {
    this.filterTeamId.set(id);
    this.currentPage.set(1);
  }

  nextPage(): void { this.currentPage.set(Math.min(this.currentPage() + 1, this.totalPages())); }
  previousPage(): void { this.currentPage.set(Math.max(this.currentPage() - 1, 1)); }

  exportExcel(): void {
    const rows = this.filteredResults().map(r => ({
      Terna: r.teamName,
      Estudiante: r.studentName,
      ...Object.fromEntries(r.evaluatorScores.map((es, i) => [`Eval_${i + 1}_${es.name}`, es.scoreFinal])),
      Promedio100: r.average100,
      [`NotaFinal_/${r.weight}`]: r.finalGrade,
      Estado: r.completionLabel
    }));
    this.downloadBlob(this.toCsv(rows), 'resultados-setu.csv', 'text/csv;charset=utf-8;');
  }

  exportPdf(): void {
    const thead = '<tr><th>Terna</th><th>Estudiante</th><th>Evaluadores (puntaje)</th><th>Prom /100</th><th>Nota Final</th><th>Estado</th></tr>';
    const tbody = this.filteredResults().map(r => {
      const evalCols = r.evaluatorScores.map(es => `${this.escape(es.name)}: ${es.scoreFinal}`).join(', ');
      return `<tr>
        <td>${this.escape(r.teamName)}</td>
        <td>${this.escape(r.studentName)}</td>
        <td>${evalCols}</td>
        <td>${r.average100}</td>
        <td><strong>${r.finalGrade}/${r.weight}</strong></td>
        <td>${this.escape(r.completionLabel)}</td>
      </tr>`;
    }).join('');

    const evalRows = this.evaluatorStats().map(e =>
      `<tr><td>${this.escape(e.name)}</td><td>${e.count}</td><td>${e.average}/100</td></tr>`
    ).join('');

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resultados SETU</title>
    <style>body{font-family:Arial,sans-serif;color:#0f172a;padding:24px}h1{font-size:22px}h2{font-size:16px;margin-top:24px}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-size:13px}
    th{background:#f1f5f9}.summary{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.card{border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px}
    @media print{button{display:none}}
    </style></head><body>
    <h1>Resultados SETU</h1>
    <p>Reporte: ${this.escape(this.lastUpdated())}</p>
    <div class="summary">
      <div class="card">Promedio: ${this.averageScore()} pts</div>
      <div class="card">Evaluaciones: ${this.reportsCount()}</div>
      <div class="card">Completadas: ${this.completedPercentage()}%</div>
    </div>
    <h2>Detalle por estudiante</h2>
    <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
    <h2>Estadísticas por evaluador</h2>
    <table><thead><tr><th>Evaluador</th><th>Evaluaciones</th><th>Promedio /100</th></tr></thead><tbody>${evalRows}</tbody></table>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  private toCsv(rows: Record<string, string | number>[]): string {
    if (!rows.length) return 'Sin datos\n';
    const headers = Object.keys(rows[0]);
    return [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
  }

  private downloadBlob(content: string, fileName: string, type: string): void {
    const blob = new Blob(['﻿' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c)
    );
  }
}
