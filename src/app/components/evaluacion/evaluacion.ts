import { Component, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../sidebar/sidebar';
import { TeamsService } from '../../services/teams.service';
import { StudentsService } from '../../services/students.service';
import { EvaluatorsService } from '../../services/evaluators.service';
import { ResultsService } from '../../services/results.service';
import { AuthService } from '../../services/auth.service';

interface EvaluationRecord {
  id: string;
  teamId: string;
  studentId: string;
  evaluatorId: string;
  score100: number;
  finalScore40: number;
  createdAt: string;
}

@Component({
  selector: 'app-evaluacion',
  templateUrl: './evaluacion.html',
  styleUrl: './evaluacion.scss',
  imports: [ReactiveFormsModule, SidebarComponent]
})
export class EvaluacionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly teamsService = inject(TeamsService);
  private readonly studentsService = inject(StudentsService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly resultsService = inject(ResultsService);

  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });
  private readonly resultsSignal = toSignal(this.resultsService.list(), { initialValue: [] });

  readonly session = this.auth.session;

  readonly selectedTeamId = signal('');
  readonly selectedEvaluatorId = signal('');
  readonly selectedStudentId = signal('');

  readonly criteria = [
    'Dominio del tema',
    'Presentación',
    'Uso de recursos',
    'Respuesta a preguntas',
    'Conclusiones'
  ];

  readonly form = this.fb.nonNullable.group({
    criterio1: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
    criterio2: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
    criterio3: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
    criterio4: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
    criterio5: [1, [Validators.required, Validators.min(1), Validators.max(5)]]
  });

  readonly teams = computed(() => {
    const currentSession = this.session();

    if (currentSession?.role !== 'evaluador') {
      return this.teamsSignal();
    }

    return this.teamsSignal().filter(team =>
      team.evaluatorIds.includes(currentSession.evaluatorId ?? '')
    );
  });

  readonly selectedTeam = computed(() =>
    this.teams().find(team => team.id === this.selectedTeamId())
  );

  readonly currentEvaluator = computed(() => {
    const currentSession = this.session();

    if (currentSession?.role === 'evaluador') {
      return this.evaluatorsSignal().find(
        evaluator => evaluator.id === currentSession.evaluatorId
      );
    }

    return this.evaluatorsSignal().find(
      evaluator => evaluator.id === this.selectedEvaluatorId()
    );
  });

  readonly evaluators = computed(() => {
    const currentSession = this.session();
    const team = this.selectedTeam();

    if (!team) return [];

    if (currentSession?.role === 'evaluador') {
      return this.evaluatorsSignal().filter(evaluator =>
        evaluator.id === currentSession.evaluatorId &&
        team.evaluatorIds.includes(evaluator.id ?? '')
      );
    }

    return this.evaluatorsSignal().filter(evaluator =>
      team.evaluatorIds.includes(evaluator.id ?? '')
    );
  });

  readonly students = computed(() => {
    const team = this.selectedTeam();

    if (!team) return [];

    return this.studentsSignal().filter(student =>
      team.studentIds.includes(student.id ?? '')
    );
  });

  constructor() {
    effect(() => {
      const currentSession = this.session();

      if (currentSession?.role === 'evaluador' && currentSession.evaluatorId) {
        this.selectedEvaluatorId.set(currentSession.evaluatorId);
      }
    });
  }

  setTeam(id: string): void {
    this.selectedTeamId.set(id);

    const currentSession = this.session();

    if (currentSession?.role === 'evaluador' && currentSession.evaluatorId) {
      this.selectedEvaluatorId.set(currentSession.evaluatorId);
    } else {
      this.selectedEvaluatorId.set('');
    }

    this.selectedStudentId.set('');

    this.form.reset({
      criterio1: 1,
      criterio2: 1,
      criterio3: 1,
      criterio4: 1,
      criterio5: 1
    });
  }

  setEvaluator(id: string): void {
    const currentSession = this.session();

    if (currentSession?.role === 'evaluador') {
      return;
    }

    this.selectedEvaluatorId.set(id);
    this.loadPreviousEvaluation();
  }

  setStudent(id: string): void {
    this.selectedStudentId.set(id);
    this.loadPreviousEvaluation();
  }

  async saveEvaluation(): Promise<void> {
    const currentSession = this.session();

    if (currentSession?.role === 'evaluador' && currentSession.evaluatorId) {
      this.selectedEvaluatorId.set(currentSession.evaluatorId);
    }

    if (!this.selectedTeamId() || !this.selectedEvaluatorId() || !this.selectedStudentId()) {
      alert('Selecciona terna, evaluador y estudiante.');
      return;
    }

    if (currentSession?.role === 'evaluador') {
      const team = this.selectedTeam();

      if (!team?.evaluatorIds.includes(currentSession.evaluatorId ?? '')) {
        alert('No tienes permiso para evaluar esta terna.');
        return;
      }
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    const total =
      value.criterio1 +
      value.criterio2 +
      value.criterio3 +
      value.criterio4 +
      value.criterio5;

    const score100 = Math.round((total / 25) * 100);
    const finalScore40 = Math.round(score100 * 0.4);

    const records = this.loadEvaluations();

    const evaluationId = this.createEvaluationId(
      this.selectedTeamId(),
      this.selectedStudentId(),
      this.selectedEvaluatorId()
    );

    const filtered = records.filter(item => item.id !== evaluationId);

    filtered.push({
      id: evaluationId,
      teamId: this.selectedTeamId(),
      studentId: this.selectedStudentId(),
      evaluatorId: this.selectedEvaluatorId(),
      score100,
      finalScore40,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem('setu_evaluations', JSON.stringify(filtered));

    const studentEvaluations = filtered.filter(item =>
      item.teamId === this.selectedTeamId() &&
      item.studentId === this.selectedStudentId()
    );

    const average100 =
      studentEvaluations.reduce((sum, item) => sum + item.score100, 0) /
      studentEvaluations.length;

    const resultFinalScore40 = Math.round(average100 * 0.4);

    const result = this.resultsSignal().find(item =>
      item.teamId === this.selectedTeamId() &&
      item.studentId === this.selectedStudentId()
    );

    if (result?.id) {
      await this.resultsService.updateScore(result.id, resultFinalScore40);
    }

    alert('Evaluación guardada correctamente.');
  }

  private loadPreviousEvaluation(): void {
    if (!this.selectedTeamId() || !this.selectedEvaluatorId() || !this.selectedStudentId()) {
      return;
    }

    const evaluationId = this.createEvaluationId(
      this.selectedTeamId(),
      this.selectedStudentId(),
      this.selectedEvaluatorId()
    );

    const previousEvaluation = this.loadEvaluations().find(item => item.id === evaluationId);

    if (!previousEvaluation) {
      this.form.reset({
        criterio1: 1,
        criterio2: 1,
        criterio3: 1,
        criterio4: 1,
        criterio5: 1
      });
    }
  }

  private createEvaluationId(
    teamId: string,
    studentId: string,
    evaluatorId: string
  ): string {
    return `${teamId}_${studentId}_${evaluatorId}`;
  }

  private loadEvaluations(): EvaluationRecord[] {
    const data = localStorage.getItem('setu_evaluations');

    try {
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}