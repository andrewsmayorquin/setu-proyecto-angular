import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ResultsService } from '../../services/results.service';
import { StudentsService } from '../../services/students.service';
import { TeamsService } from '../../services/teams.service';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Componente de visualización de resultados.
 * Muestra estadísticas, gráficas por ciclo y tabla de resultados.
 * Los datos se obtienen en tiempo real de las colecciones
 * 'resultados', 'estudiantes' y 'ternas' de Firestore.
 */
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
    return this.resultsSignal().map(result => {
      const student = students.find(item => item.id === result.studentId);
      return {
        ...result,
        studentName: student?.name ?? 'Sin nombre'
      };
    });
  });

  readonly averageScore = computed(() => {
    const results = this.resultsSignal();
    if (results.length === 0) {
      return 0;
    }
    const total = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round(total / results.length);
  });

  readonly reportsCount = computed(() => this.resultsSignal().length);
  readonly highlightedTeams = computed(() => this.teamsSignal().filter(team => team.status === 'completed').length);

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
}
