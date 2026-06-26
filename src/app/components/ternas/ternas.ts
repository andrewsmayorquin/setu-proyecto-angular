import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {
  DEFAULT_CRITERIA,
  EvaluationCriterion,
  Team,
  TeamStatus,
  TeamsService
} from '../../services/teams.service';
import { EvaluatorsService } from '../../services/evaluators.service';
import { ResultsService } from '../../services/results.service';
import { StudentsService } from '../../services/students.service';
import { KeyValuePipe } from '@angular/common';
import { TippyDirective } from '../../directives/tippy.directive';
import { SidebarComponent } from '../sidebar/sidebar';

function minArrayLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!Array.isArray(value)) return null;
    return value.length >= min ? null : { minArrayLength: { min, actual: value.length } };
  };
}

/** Distributes students round-robin among evaluators for equitable assignment. */
function autoAssign(studentIds: string[], evaluatorIds: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  evaluatorIds.forEach(id => (map[id] = []));
  studentIds.forEach((sid, i) => {
    map[evaluatorIds[i % evaluatorIds.length]].push(sid);
  });
  return map;
}

@Component({
  selector: 'app-ternas',
  templateUrl: './ternas.html',
  styleUrl: './ternas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SidebarComponent, TippyDirective, KeyValuePipe]
})
export class TernasComponent {
  private readonly teamsService = inject(TeamsService);
  private readonly studentsService = inject(StudentsService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly resultsService = inject(ResultsService);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });

  readonly search = signal('');
  readonly studentSearch = signal('');
  readonly evaluatorSearch = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editingTeam = signal<Team | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);
  readonly saving = signal(false);

  /** Preview of auto-assigned students per evaluator (populated after auto-assign). */
  readonly assignmentPreview = signal<Record<string, string[]>>({});
  readonly showPreview = computed(() => Object.keys(this.assignmentPreview()).length > 0);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    date: ['', Validators.required],
    hora: ['', Validators.required],
    aula: ['', Validators.required],
    weight: [40, [Validators.required, Validators.min(1), Validators.max(100)]],
    studentIds: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required, minArrayLength(1)]
    }),
    evaluatorIds: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required, minArrayLength(2)]
    }),
    status: ['pending' as TeamStatus, Validators.required],
    criteria: this.fb.array(this.buildCriteriaControls(DEFAULT_CRITERIA))
  });

  readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  // Reactive bridges from FormControl valueChanges → signals so computed() tracks them.
  private readonly studentIdsSignal = toSignal(
    this.form.controls.studentIds.valueChanges,
    { initialValue: this.form.controls.studentIds.value }
  );
  private readonly evaluatorIdsSignal = toSignal(
    this.form.controls.evaluatorIds.valueChanges,
    { initialValue: this.form.controls.evaluatorIds.value }
  );
  private readonly criteriaValuesSignal = toSignal(
    this.form.controls.criteria.valueChanges,
    { initialValue: this.form.controls.criteria.value as EvaluationCriterion[] }
  );

  readonly teams = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.teamsSignal().filter(team =>
      !term ||
      team.name.toLowerCase().includes(term) ||
      (team.id ?? '').toLowerCase().includes(term)
    );
  });

  readonly selectedStudents = computed(() => {
    const ids = this.studentIdsSignal();
    return this.studentsSignal().filter(s => ids.includes(s.id ?? ''));
  });

  readonly selectedEvaluators = computed(() => {
    const ids = this.evaluatorIdsSignal();
    return this.evaluatorsSignal().filter(e => ids.includes(e.id ?? ''));
  });

  readonly filteredStudents = computed(() => {
    const term = this.studentSearch().trim().toLowerCase();
    const selectedIds = this.studentIdsSignal();
    if (!term) return [];
    return this.studentsSignal()
      .filter(s => !selectedIds.includes(s.id ?? ''))
      .filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.program.toLowerCase().includes(term)
      )
      .slice(0, 5);
  });

  readonly filteredEvaluators = computed(() => {
    const term = this.evaluatorSearch().trim().toLowerCase();
    const selectedIds = this.evaluatorIdsSignal();
    if (!term) return [];
    return this.evaluatorsSignal()
      .filter(e => !selectedIds.includes(e.id ?? ''))
      .filter(e =>
        e.name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        e.specialty.toLowerCase().includes(term)
      )
      .slice(0, 5);
  });

  readonly criteriaWeightSum = computed(() =>
    (this.criteriaValuesSignal() as EvaluationCriterion[]).reduce(
      (sum, c) => sum + (Number(c?.weight) || 0),
      0
    )
  );

  readonly criteriaWeightValid = computed(() => this.criteriaWeightSum() === 100);

  readonly submitHint = computed(() => {
    this.formStatus();
    if (this.form.valid && this.criteriaWeightValid()) return '';
    const c = this.form.controls;
    if (c.name.invalid)
      return c.name.value.length > 0 && c.name.value.length < 3
        ? 'El nombre debe tener al menos 3 caracteres.'
        : 'El nombre de la terna es obligatorio.';
    if (c.date.invalid) return 'Selecciona la fecha de la terna.';
    if (c.hora.invalid) return 'Indica la hora de la evaluación.';
    if (c.aula.invalid) return 'Indica el aula o lugar de evaluación.';
    if (c.weight.invalid) return 'La ponderación debe estar entre 1 y 100.';
    if ((c.studentIds.value?.length ?? 0) < 1) return 'Selecciona al menos un estudiante.';
    if ((c.evaluatorIds.value?.length ?? 0) < 2) return 'Selecciona al menos dos evaluadores.';
    if (!this.criteriaWeightValid())
      return `Los pesos de criterios suman ${this.criteriaWeightSum()}% (deben sumar 100%).`;
    return 'Completa todos los campos requeridos.';
  });

  get criteriaArray(): FormArray {
    return this.form.controls.criteria as FormArray;
  }

  setSearch(value: string): void { this.search.set(value); }
  setStudentSearch(value: string): void { this.studentSearch.set(value); }
  setEvaluatorSearch(value: string): void { this.evaluatorSearch.set(value); }

  addStudent(id: string | undefined): void {
    if (!id) return;
    const current = this.form.controls.studentIds.value;
    if (!current.includes(id)) {
      this.form.controls.studentIds.setValue([...current, id]);
      this.form.controls.studentIds.markAsTouched();
    }
    this.studentSearch.set('');
    this.assignmentPreview.set({});
  }

  removeStudent(id: string | undefined): void {
    if (!id) return;
    this.form.controls.studentIds.setValue(
      this.form.controls.studentIds.value.filter(item => item !== id)
    );
    this.form.controls.studentIds.markAsTouched();
    this.assignmentPreview.set({});
  }

  addEvaluator(id: string | undefined): void {
    if (!id) return;
    const current = this.form.controls.evaluatorIds.value;
    if (!current.includes(id)) {
      this.form.controls.evaluatorIds.setValue([...current, id]);
      this.form.controls.evaluatorIds.markAsTouched();
    }
    this.evaluatorSearch.set('');
    this.assignmentPreview.set({});
  }

  removeEvaluator(id: string | undefined): void {
    if (!id) return;
    this.form.controls.evaluatorIds.setValue(
      this.form.controls.evaluatorIds.value.filter(item => item !== id)
    );
    this.form.controls.evaluatorIds.markAsTouched();
    this.assignmentPreview.set({});
  }

  /** Auto-distributes students equitably among evaluators (round-robin). */
  autoAssignStudents(): void {
    const studentIds = this.form.controls.studentIds.value;
    const evaluatorIds = this.form.controls.evaluatorIds.value;

    if (studentIds.length === 0 || evaluatorIds.length === 0) {
      this.toastr.warning('Agrega estudiantes y evaluadores antes de asignar.');
      return;
    }

    const map = autoAssign(studentIds, evaluatorIds);
    this.assignmentPreview.set(map);
    this.toastr.info('Vista previa de asignación generada. Guarda la terna para confirmar.');
  }

  addCriterion(): void {
    const arr = this.criteriaArray;
    if (arr.length >= 10) {
      this.toastr.warning('Máximo 10 criterios por terna.');
      return;
    }
    arr.push(this.fb.nonNullable.group({
      id: [crypto.randomUUID()],
      name: ['', Validators.required],
      weight: [0, [Validators.required, Validators.min(1), Validators.max(100)]],
      maxScore: [10, [Validators.required, Validators.min(1), Validators.max(100)]]
    }));
  }

  removeCriterion(index: number): void {
    if (this.criteriaArray.length <= 1) {
      this.toastr.warning('Debe haber al menos un criterio.');
      return;
    }
    this.criteriaArray.removeAt(index);
  }

  async saveTeam(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.warning(this.submitHint() || 'Completa todos los campos requeridos');
      return;
    }

    if (!this.criteriaWeightValid()) {
      this.toastr.warning(`Los pesos de criterios suman ${this.criteriaWeightSum()}% — deben sumar exactamente 100%.`);
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      const criteria: EvaluationCriterion[] = (value.criteria as EvaluationCriterion[]);

      const evaluatorStudentMap: Record<string, string[]> =
        Object.keys(this.assignmentPreview()).length > 0
          ? this.assignmentPreview()
          : autoAssign(value.studentIds, value.evaluatorIds);

      const payload: Team = {
        name: value.name.trim(),
        date: value.date,
        hora: value.hora,
        aula: value.aula.trim(),
        weight: value.weight,
        criteria,
        studentsCount: value.studentIds.length,
        studentIds: value.studentIds,
        evaluatorIds: value.evaluatorIds,
        evaluatorStudentMap,
        status: value.status
      };

      const editingId = this.editingId();
      const previousStatus = this.editingTeam()?.status;
      const alreadyGenerated = this.editingTeam()?.resultsGenerated;

      if (editingId) {
        await this.teamsService.update(editingId, payload);

        if (payload.status === 'completed' && previousStatus !== 'completed' && !alreadyGenerated) {
          await this.resultsService.createForTeam(editingId, payload.name, payload.studentIds);
          await this.teamsService.update(editingId, { resultsGenerated: true });
        }

        this.toastr.success('Terna actualizada exitosamente');
      } else {
        const ref = await this.teamsService.create({ ...payload, resultsGenerated: false });

        if (payload.status === 'completed') {
          await this.resultsService.createForTeam(ref.id, payload.name, payload.studentIds);
          await this.teamsService.update(ref.id, { resultsGenerated: true });
        }

        this.toastr.success('Terna creada exitosamente');
      }

      this.resetForm();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al guardar la terna';
      this.toastr.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  editTeam(team: Team): void {
    if (!team.id) return;

    this.editingId.set(team.id);
    this.editingTeam.set(team);

    // Rebuild criteria FormArray from stored data
    const criteriaArr = this.criteriaArray;
    while (criteriaArr.length) criteriaArr.removeAt(0);
    const criteriaToLoad = (team.criteria?.length ? team.criteria : DEFAULT_CRITERIA);
    criteriaToLoad.forEach(c => criteriaArr.push(this.buildCriterionGroup(c)));

    this.form.patchValue({
      name: team.name,
      date: team.date,
      hora: team.hora ?? '',
      aula: team.aula ?? '',
      weight: team.weight ?? 40,
      studentIds: team.studentIds ?? [],
      evaluatorIds: team.evaluatorIds ?? [],
      status: team.status
    });

    this.assignmentPreview.set(team.evaluatorStudentMap ?? {});
    this.studentSearch.set('');
    this.evaluatorSearch.set('');
  }

  async removeTeam(id: string): Promise<void> {
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta terna?');
    if (!confirmed) return;

    try {
      await this.teamsService.remove(id);
      if (this.editingId() === id) this.resetForm();
      this.toastr.success('Terna eliminada exitosamente');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar la terna';
      this.toastr.error(msg);
    }
  }

  cancelEdit(): void { this.resetForm(); }

  /** Returns the name of an evaluator by id (for assignment preview). */
  evaluatorName(id: string): string {
    return this.evaluatorsSignal().find(e => e.id === id)?.name ?? id;
  }

  /** Returns the name of a student by id (for assignment preview). */
  studentName(id: string): string {
    return this.studentsSignal().find(s => s.id === id)?.name ?? id;
  }

  private buildCriterionGroup(c: EvaluationCriterion) {
    return this.fb.nonNullable.group({
      id: [c.id],
      name: [c.name, Validators.required],
      weight: [c.weight, [Validators.required, Validators.min(1), Validators.max(100)]],
      maxScore: [c.maxScore, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
  }

  private buildCriteriaControls(criteria: EvaluationCriterion[]) {
    return criteria.map(c => this.buildCriterionGroup(c));
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.editingTeam.set(null);
    this.studentSearch.set('');
    this.evaluatorSearch.set('');
    this.assignmentPreview.set({});

    const criteriaArr = this.criteriaArray;
    while (criteriaArr.length) criteriaArr.removeAt(0);
    DEFAULT_CRITERIA.forEach(c => criteriaArr.push(this.buildCriterionGroup(c)));

    this.form.reset({
      name: '',
      date: '',
      hora: '',
      aula: '',
      weight: 40,
      studentIds: [],
      evaluatorIds: [],
      status: 'pending' as TeamStatus
    });
  }
}
