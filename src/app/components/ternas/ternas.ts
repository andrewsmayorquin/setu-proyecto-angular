import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Team, TeamStatus, TeamsService } from '../../services/teams.service';
import { EvaluatorsService } from '../../services/evaluators.service';
import { ResultsService } from '../../services/results.service';
import { StudentsService } from '../../services/students.service';
import { TippyDirective } from '../../directives/tippy.directive';
import { SidebarComponent } from '../sidebar/sidebar';

function minArrayLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!Array.isArray(value)) return null;
    return value.length >= min ? null : { minArrayLength: { min, actual: value.length } };
  };
}

@Component({
  selector: 'app-ternas',
  templateUrl: './ternas.html',
  styleUrl: './ternas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SidebarComponent, TippyDirective]
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

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    date: ['', Validators.required],
    studentIds: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required, minArrayLength(1)]
    }),
    evaluatorIds: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required, minArrayLength(2)]
    }),
    status: ['pending' as TeamStatus, Validators.required]
  });

  readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  readonly teams = computed(() => {
    const term = this.search().trim().toLowerCase();

    return this.teamsSignal().filter(team => {
      if (!term) return true;
      return team.name.toLowerCase().includes(term) || (team.id ?? '').toLowerCase().includes(term);
    });
  });

  readonly students = computed(() => this.studentsSignal());
  readonly evaluators = computed(() => this.evaluatorsSignal());

  readonly selectedStudents = computed(() => {
    const ids = this.form.controls.studentIds.value;
    return this.studentsSignal().filter(student => ids.includes(student.id ?? ''));
  });

  readonly selectedEvaluators = computed(() => {
    const ids = this.form.controls.evaluatorIds.value;
    return this.evaluatorsSignal().filter(evaluator => ids.includes(evaluator.id ?? ''));
  });

  readonly filteredStudents = computed(() => {
    const term = this.studentSearch().trim().toLowerCase();
    const selectedIds = this.form.controls.studentIds.value;

    if (!term) return [];

    return this.studentsSignal()
      .filter(student => !selectedIds.includes(student.id ?? ''))
      .filter(student =>
        student.name.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.program.toLowerCase().includes(term)
      )
      .slice(0, 5);
  });

  readonly filteredEvaluators = computed(() => {
    const term = this.evaluatorSearch().trim().toLowerCase();
    const selectedIds = this.form.controls.evaluatorIds.value;

    if (!term) return [];

    return this.evaluatorsSignal()
      .filter(evaluator => !selectedIds.includes(evaluator.id ?? ''))
      .filter(evaluator =>
        evaluator.name.toLowerCase().includes(term) ||
        evaluator.email.toLowerCase().includes(term) ||
        evaluator.specialty.toLowerCase().includes(term)
      )
      .slice(0, 5);
  });

  readonly submitHint = computed(() => {
    this.formStatus();

    if (this.form.valid) return '';

    const c = this.form.controls;

    if (c.name.invalid) {
      return c.name.value.length > 0 && c.name.value.length < 3
        ? 'El nombre de la terna debe tener al menos 3 caracteres.'
        : 'El nombre de la terna es obligatorio.';
    }

    if (c.date.invalid) return 'Selecciona la fecha de la terna.';

    if ((c.studentIds.value?.length ?? 0) < 1) return 'Selecciona al menos un estudiante.';

    if ((c.evaluatorIds.value?.length ?? 0) < 2) return 'Selecciona al menos dos evaluadores.';

    return 'Faltan campos por llenar.';
  });

  setSearch(value: string): void {
    this.search.set(value);
  }

  setStudentSearch(value: string): void {
    this.studentSearch.set(value);
  }

  setEvaluatorSearch(value: string): void {
    this.evaluatorSearch.set(value);
  }

  addStudent(id: string | undefined): void {
    if (!id) return;

    const current = this.form.controls.studentIds.value;

    if (!current.includes(id)) {
      this.form.controls.studentIds.setValue([...current, id]);
      this.form.controls.studentIds.markAsTouched();
      this.form.controls.studentIds.updateValueAndValidity();
    }

    this.studentSearch.set('');
  }

  removeStudent(id: string | undefined): void {
    if (!id) return;

    const current = this.form.controls.studentIds.value.filter(item => item !== id);
    this.form.controls.studentIds.setValue(current);
    this.form.controls.studentIds.markAsTouched();
    this.form.controls.studentIds.updateValueAndValidity();
  }

  addEvaluator(id: string | undefined): void {
    if (!id) return;

    const current = this.form.controls.evaluatorIds.value;

    if (!current.includes(id)) {
      this.form.controls.evaluatorIds.setValue([...current, id]);
      this.form.controls.evaluatorIds.markAsTouched();
      this.form.controls.evaluatorIds.updateValueAndValidity();
    }

    this.evaluatorSearch.set('');
  }

  removeEvaluator(id: string | undefined): void {
    if (!id) return;

    const current = this.form.controls.evaluatorIds.value.filter(item => item !== id);
    this.form.controls.evaluatorIds.setValue(current);
    this.form.controls.evaluatorIds.markAsTouched();
    this.form.controls.evaluatorIds.updateValueAndValidity();
  }

  async saveTeam(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.warning(this.submitHint() || 'Completa todos los campos requeridos');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();

      const payload: Team = {
        name: value.name.trim(),
        date: value.date,
        studentsCount: value.studentIds.length,
        studentIds: value.studentIds,
        evaluatorIds: value.evaluatorIds,
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

    this.form.patchValue({
      name: team.name,
      date: team.date,
      studentIds: team.studentIds ?? [],
      evaluatorIds: team.evaluatorIds ?? [],
      status: team.status
    });

    this.studentSearch.set('');
    this.evaluatorSearch.set('');
  }

  async removeTeam(id: string): Promise<void> {
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta terna?');
    if (!confirmed) return;

    try {
      await this.teamsService.remove(id);

      if (this.editingId() === id) {
        this.resetForm();
      }

      this.toastr.success('Terna eliminada exitosamente');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar la terna';
      this.toastr.error(msg);
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.editingTeam.set(null);
    this.studentSearch.set('');
    this.evaluatorSearch.set('');

    this.form.reset({
      name: '',
      date: '',
      studentIds: [],
      evaluatorIds: [],
      status: 'pending' as TeamStatus
    });
  }
}