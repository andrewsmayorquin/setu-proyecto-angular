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

/**
 * Validador personalizado para verificar que un array tenga
 * al menos un número mínimo de elementos seleccionados.
 */
function minArrayLength(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!Array.isArray(value)) {
      return null;
    }
    return value.length >= min ? null : { minArrayLength: { min, actual: value.length } };
  };
}

/**
 * Componente de gestión de ternas.
 * Permite crear, editar, eliminar y buscar ternas.
 * Cada terna se persiste en la colección 'ternas' de Firestore.
 */
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

  // Señales de datos en tiempo real desde Firestore
  private readonly teamsSignal = toSignal(this.teamsService.list(), { initialValue: [] });
  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });

  /** Término de búsqueda para filtrar ternas */
  readonly search = signal('');

  /** Lista de ternas filtrada por búsqueda */
  readonly teams = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.teamsSignal().filter(team => {
      if (!term) {
        return true;
      }
      return team.name.toLowerCase().includes(term) || (team.id ?? '').toLowerCase().includes(term);
    });
  });

  /** Lista de estudiantes disponibles para asignar */
  readonly students = computed(() => this.studentsSignal());
  /** Lista de evaluadores disponibles para asignar */
  readonly evaluators = computed(() => this.evaluatorsSignal());

  /** ID de la terna que se está editando (null si se está creando) */
  readonly editingId = signal<string | null>(null);
  /** Datos originales de la terna en edición */
  readonly editingTeam = signal<Team | null>(null);
  /** Indica si se está en modo edición */
  readonly isEditing = computed(() => this.editingId() !== null);
  /** Indica si se está procesando una operación */
  readonly saving = signal(false);

  /** Formulario reactivo para crear/editar ternas */
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

  /** Observa cambios del estado del formulario para recalcular el hint */
  readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  /**
   * Mensaje dinámico que indica qué campo falta por completar.
   * Se muestra como tooltip y como texto debajo del formulario.
   */
  readonly submitHint = computed(() => {
    this.formStatus();
    if (this.form.valid) {
      return '';
    }
    const c = this.form.controls;
    if (c.name.invalid) {
      return c.name.value.length > 0 && c.name.value.length < 3
        ? 'El nombre de la terna debe tener al menos 3 caracteres.'
        : 'El nombre de la terna es obligatorio.';
    }
    if (c.date.invalid) {
      return 'Selecciona la fecha de la terna.';
    }
    if ((c.studentIds.value?.length ?? 0) < 1) {
      return 'Selecciona al menos un estudiante.';
    }
    if ((c.evaluatorIds.value?.length ?? 0) < 2) {
      return 'Selecciona al menos dos evaluadores.';
    }
    return 'Faltan campos por llenar.';
  });

  /**
   * Guarda la terna en Firestore (crea o actualiza según el modo).
   * Si el estado cambia a 'completed', genera resultados automáticamente.
   */
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
        // Actualizar terna existente en Firestore
        await this.teamsService.update(editingId, payload);
        // Generar resultados si cambió a completada y no se habían generado
        if (payload.status === 'completed' && previousStatus !== 'completed' && !alreadyGenerated) {
          await this.resultsService.createForTeam(editingId, payload.name, payload.studentIds);
          await this.teamsService.update(editingId, { resultsGenerated: true });
        }
        this.toastr.success('Terna actualizada exitosamente');
      } else {
        // Crear nueva terna en Firestore
        const ref = await this.teamsService.create({ ...payload, resultsGenerated: false });
        // Generar resultados si se creó como completada
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

  /** Carga los datos de una terna en el formulario para editarla */
  editTeam(team: Team): void {
    if (!team.id) {
      return;
    }
    this.editingId.set(team.id);
    this.editingTeam.set(team);
    this.form.patchValue({
      name: team.name,
      date: team.date,
      studentIds: team.studentIds ?? [],
      evaluatorIds: team.evaluatorIds ?? [],
      status: team.status
    });
  }

  /** Elimina una terna de Firestore previa confirmación del usuario */
  async removeTeam(id: string): Promise<void> {
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta terna?');
    if (!confirmed) {
      return;
    }

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

  /** Cancela la edición y limpia el formulario */
  cancelEdit(): void {
    this.resetForm();
  }

  /** Reinicia el formulario y los estados de edición */
  private resetForm(): void {
    this.editingId.set(null);
    this.editingTeam.set(null);
    this.form.reset({
      name: '',
      date: '',
      studentIds: [],
      evaluatorIds: [],
      status: 'pending' as TeamStatus
    });
  }

  /** Actualiza el término de búsqueda */
  setSearch(value: string): void {
    this.search.set(value);
  }
}
