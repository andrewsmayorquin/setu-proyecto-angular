import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { SidebarComponent } from '../sidebar/sidebar';
import { AuthService } from '../../services/auth.service';
import { EvaluationsService } from '../../services/evaluations.service';
import { EvaluationCriterion, TeamsService } from '../../services/teams.service';
import { StudentsService } from '../../services/students.service';
import { EvaluatorsService } from '../../services/evaluators.service';

@Component({
  selector: 'app-evaluacion',
  templateUrl: './evaluacion.html',
  styleUrl: './evaluacion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SidebarComponent]
})
export class EvaluacionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly teamsService = inject(TeamsService);
  private readonly studentsService = inject(StudentsService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly evaluationsService = inject(EvaluationsService);
  private readonly toastr = inject(ToastrService);

  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });
  private readonly evaluationsSignal = toSignal(this.evaluationsService.list(), { initialValue: [] });

  readonly session = this.auth.session;

  readonly selectedTeamId = signal('');
  readonly selectedEvaluatorId = signal('');
  readonly selectedStudentId = signal('');
  readonly autoSaveStatus = signal<'idle' | 'saving' | 'saved'>('idle');

  /** Dynamic form fields keyed by criterion id. */
  readonly criteriaForm = new FormRecord<ReturnType<FormBuilder['nonNullable']['control']>>({});
  // Reactive bridge so computed() tracks criteriaForm value changes as a signal.
  private readonly criteriaFormValues = toSignal(this.criteriaForm.valueChanges, {
    initialValue: this.criteriaForm.value
  });

  // ── Derived from selected terna ──────────────────────────────────────────

  readonly selectedTeam = computed(() =>
    this.teamsSignal().find(t => t.id === this.selectedTeamId())
  );

  readonly criteria = computed((): EvaluationCriterion[] =>
    this.selectedTeam()?.criteria ?? []
  );

  /** Teams visible to the current user. */
  readonly teams = computed(() => {
    const s = this.session();
    if (s?.role !== 'evaluador') return this.teamsSignal();
    return this.teamsSignal().filter(t => t.evaluatorIds.includes(s.evaluatorId ?? ''));
  });

  /** Evaluators belonging to the selected terna (limited to self for evaluador role). */
  readonly evaluators = computed(() => {
    const team = this.selectedTeam();
    if (!team) return [];
    const s = this.session();
    if (s?.role === 'evaluador') {
      return this.evaluatorsSignal().filter(
        e => e.id === s.evaluatorId && team.evaluatorIds.includes(e.id ?? '')
      );
    }
    return this.evaluatorsSignal().filter(e => team.evaluatorIds.includes(e.id ?? ''));
  });

  /**
   * Students the current evaluator is assigned to.
   * For admin: all students in the terna.
   */
  readonly students = computed(() => {
    const team = this.selectedTeam();
    if (!team) return [];
    const s = this.session();
    const evalId = s?.role === 'evaluador' ? (s.evaluatorId ?? '') : this.selectedEvaluatorId();

    const assignedIds = evalId && team.evaluatorStudentMap
      ? (team.evaluatorStudentMap[evalId] ?? team.studentIds)
      : team.studentIds;

    return this.studentsSignal().filter(st => assignedIds.includes(st.id ?? ''));
  });

  /** Completion status for each student in the panel. */
  readonly studentStatuses = computed(() => {
    const team = this.selectedTeam();
    const evalId = this.activeEvaluatorId();
    if (!team || !evalId) return new Map<string, boolean>();

    const map = new Map<string, boolean>();
    for (const st of this.students()) {
      const ev = this.evaluationsService.find(team.id ?? '', st.id ?? '', evalId);
      map.set(st.id ?? '', ev?.status === 'submitted');
    }
    return map;
  });

  readonly activeEvaluatorId = computed(() => {
    const s = this.session();
    return s?.role === 'evaluador' ? (s.evaluatorId ?? '') : this.selectedEvaluatorId();
  });

  readonly currentEvaluator = computed(() =>
    this.evaluatorsSignal().find(e => e.id === this.activeEvaluatorId())
  );

  /** Weighted total score 0–100 from the current form values. */
  readonly liveScore = computed((): number => {
    const crits = this.criteria();
    const values = this.criteriaFormValues() as Record<string, number>;
    if (!crits.length) return 0;
    let total = 0;
    for (const c of crits) {
      const val = Number(values[c.id] ?? 0);
      total += (val / c.maxScore) * c.weight;
    }
    return Math.round(total);
  });

  /** Final grade after applying terna weight. */
  readonly liveGrade = computed((): number => {
    const weight = this.selectedTeam()?.weight ?? 40;
    return Math.round(this.liveScore() * weight / 100);
  });

  constructor() {
    // Auto-set evaluatorId for evaluador role.
    effect(() => {
      const s = this.session();
      if (s?.role === 'evaluador' && s.evaluatorId) {
        this.selectedEvaluatorId.set(s.evaluatorId);
      }
    });

    // Rebuild form controls when criteria change.
    effect(() => {
      const crits = this.criteria();
      // Remove old controls
      Object.keys(this.criteriaForm.controls).forEach(k => this.criteriaForm.removeControl(k));
      // Add one control per criterion
      for (const c of crits) {
        this.criteriaForm.addControl(
          c.id,
          this.fb.nonNullable.control(0, [Validators.min(0), Validators.max(c.maxScore)])
        );
      }
    });

  }

  setTeam(id: string): void {
    this.selectedTeamId.set(id);
    const s = this.session();
    if (s?.role !== 'evaluador') this.selectedEvaluatorId.set('');
    this.selectedStudentId.set('');
    this.autoSaveStatus.set('idle');
  }

  setEvaluator(id: string): void {
    if (this.session()?.role === 'evaluador') return;
    this.selectedEvaluatorId.set(id);
    this.selectedStudentId.set('');
    this.autoSaveStatus.set('idle');
  }

  setStudent(id: string): void {
    this.selectedStudentId.set(id);
    this.loadExisting();
    this.autoSaveStatus.set('idle');
  }

  onCriterionChange(): void {
    if (!this.selectedTeamId() || !this.activeEvaluatorId() || !this.selectedStudentId()) return;
    this.autoSaveStatus.set('saving');
    this.evaluationsService.scheduleAutoSave(this.buildRecord('draft'));
    // Show "saved" after the 2s debounce settles.
    setTimeout(() => this.autoSaveStatus.set('saved'), 2500);
  }

  async submitEvaluation(): Promise<void> {
    if (!this.selectedTeamId() || !this.activeEvaluatorId() || !this.selectedStudentId()) {
      this.toastr.warning('Selecciona terna, evaluador y estudiante.');
      return;
    }

    if (this.session()?.role === 'evaluador') {
      const team = this.selectedTeam();
      if (!team?.evaluatorIds.includes(this.activeEvaluatorId())) {
        this.toastr.error('No tienes permiso para evaluar esta terna.');
        return;
      }
    }

    if (this.criteriaForm.invalid) {
      this.criteriaForm.markAllAsTouched();
      this.toastr.warning('Completa todos los criterios antes de guardar.');
      return;
    }

    try {
      await this.evaluationsService.save(this.buildRecord('submitted'));
      this.autoSaveStatus.set('saved');
      this.toastr.success('Evaluación guardada exitosamente.');
    } catch {
      this.toastr.error('Error al guardar la evaluación.');
    }
  }

  private buildRecord(status: 'draft' | 'submitted') {
    const crits = this.criteria();
    const criteriaScores = crits.map(c => ({
      criterionId: c.id,
      score: Number(this.criteriaForm.get(c.id)?.value ?? 0)
    }));

    // Calculate totalScore directly from form controls (not via signal) to avoid
    // potential stale-signal issues when called from within an effect context.
    const totalScore = Math.round(
      crits.reduce((sum, c) => {
        const val = Number(this.criteriaForm.get(c.id)?.value ?? 0);
        return sum + (val / c.maxScore) * c.weight;
      }, 0)
    );

    return {
      ternaId: this.selectedTeamId(),
      studentId: this.selectedStudentId(),
      evaluatorId: this.activeEvaluatorId(),
      criteriaScores,
      totalScore,
      status,
      savedAt: new Date().toISOString()
    };
  }

  private loadExisting(): void {
    const existing = this.evaluationsService.find(
      this.selectedTeamId(),
      this.selectedStudentId(),
      this.activeEvaluatorId()
    );

    for (const c of this.criteria()) {
      const saved = existing?.criteriaScores.find(cs => cs.criterionId === c.id);
      this.criteriaForm.get(c.id)?.setValue(saved?.score ?? 0);
    }
  }
}
