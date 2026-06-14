import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ResultsService } from '../../services/results.service';
import { StudentsService } from '../../services/students.service';
import { TeamsService } from '../../services/teams.service';
import { SidebarComponent } from '../sidebar/sidebar';

interface EvaluationRecord {
  id?: string;
  teamId: string;
  studentId: string;
  evaluatorId: string;
  score100: number;
  finalScore40?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-resultados',
  templateUrl: './resultados.html',
  styleUrl: './resultados.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent]
})
export class ResultadosComponent {
  private readonly resultsService = inject(ResultsService);
  private readonly studentsService = inject(StudentsService);
  private readonly teamsService = inject(TeamsService);

  private readonly resultsSignal = toSignal(this.resultsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });

  readonly results = computed(() => {
    const students = this.studentsSignal();
    const evaluations = this.loadEvaluations();

    return this.resultsSignal().map(result => {
      const student = students.find(item => item.id === result.studentId);

      const studentEvaluations = evaluations.filter(item =>
        item.teamId === result.teamId &&
        item.studentId === result.studentId
      );

      const scores40 = studentEvaluations.map(item =>
        Math.round(item.score100 * 0.4)
      );

      const average40 =
        scores40.length > 0
          ? Math.round(scores40.reduce((sum, score) => sum + score, 0) / scores40.length)
          : result.score;

      return {
        ...result,
        studentName: student?.name ?? 'Sin nombre',
        evaluatorScores: scores40,
        evaluator1: scores40[0] ?? 0,
        evaluator2: scores40[1] ?? 0,
        evaluator3: scores40[2] ?? 0,
        evaluationsCount: scores40.length,
        averageScore: average40,
        score: average40
      };
    });
  });

  readonly averageScore = computed(() => {
    const results = this.results();
    if (results.length === 0) {
      return 0;
    }

    const total = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round(total / results.length);
  });

  readonly reportsCount = computed(() => this.resultsSignal().length);

  readonly highlightedTeams = computed(() =>
    this.teamsSignal().filter(team => team.status === 'completed').length
  );

  readonly cycleStats = computed(() => {
    const teams = this.teamsSignal();
    const counts = new Map<string, number>();

    teams.forEach(team => {
      if (!team.date) {
        return;
      }

      const year = new Date(team.date).getFullYear().toString();
      counts.set(year, (counts.get(year) ?? 0) + 1);
    });

    const entries = Array.from(counts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => Number(a.year) - Number(b.year));

    const max = Math.max(0, ...entries.map(item => item.count));

    return entries.map(item => ({
      ...item,
      height: max === 0 ? 0 : Math.round((item.count / max) * 100)
    }));
  });

  private loadEvaluations(): EvaluationRecord[] {
    const data = localStorage.getItem('setu_evaluations');

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as EvaluationRecord[];
    } catch {
      return [];
    }
  }
}