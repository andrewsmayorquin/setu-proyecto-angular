import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EvaluatorsService } from '../../services/evaluators.service';
import { ResultsService } from '../../services/results.service';
import { StudentsService } from '../../services/students.service';
import { TeamsService } from '../../services/teams.service';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Componente del panel de control principal.
 * Muestra estadísticas en tiempo real obtenidas de las colecciones
 * 'ternas', 'estudiantes', 'evaluadores' y 'resultados' de Firestore.
 *
 * Los contadores se actualizan automáticamente gracias a onSnapshot.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent, RouterLink]
})
export class HomeComponent {
  private readonly teamsService = inject(TeamsService);
  private readonly studentsService = inject(StudentsService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly resultsService = inject(ResultsService);

  // Señales en tiempo real desde Firestore (se actualizan con onSnapshot)
  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });
  private readonly resultsSignal = toSignal(this.resultsService.list(), { initialValue: [] });

  /** Total de ternas registradas en Firestore */
  readonly totalTeams = computed(() => this.teamsSignal().length);
  /** Total de estudiantes registrados en Firestore */
  readonly totalStudents = computed(() => this.studentsSignal().length);
  /** Total de evaluadores registrados en Firestore */
  readonly totalEvaluators = computed(() => this.evaluatorsSignal().length);
  /** Total de resultados generados en Firestore */
  readonly totalResults = computed(() => this.resultsSignal().length);
  /** Cantidad de ternas con estado 'pending' */
  readonly pendingTeams = computed(() => this.teamsSignal().filter(team => team.status === 'pending').length);

  /** Últimas 5 ternas ordenadas por fecha más reciente */
  readonly recentTeams = computed(() => {
    const teams = [...this.teamsSignal()];
    return teams
      .filter(team => !!team.date)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 5);
  });
}