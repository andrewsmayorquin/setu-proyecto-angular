import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Evaluator, EvaluatorsService } from '../../services/evaluators.service';
import { TippyDirective } from '../../directives/tippy.directive';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Componente de gestión de evaluadores.
 * Permite crear, editar, eliminar y buscar evaluadores.
 * Los datos se persisten en la colección 'evaluadores' de Firestore
 * y se actualizan en tiempo real mediante onSnapshot.
 */
@Component({
  selector: 'app-evaluadores',
  templateUrl: './evaluadores.html',
  styleUrl: './evaluadores.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SidebarComponent, TippyDirective]
})
export class EvaluadoresComponent {
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  private readonly evaluatorsSignal = toSignal(this.evaluatorsService.list(), { initialValue: [] });
  readonly search = signal('');

  readonly evaluators = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.evaluatorsSignal().filter(evaluator => {
      if (!term) {
        return true;
      }
      return (
        evaluator.name.toLowerCase().includes(term) ||
        evaluator.email.toLowerCase().includes(term) ||
        evaluator.specialty.toLowerCase().includes(term) ||
        (evaluator.id ?? '').toLowerCase().includes(term)
      );
    });
  });

  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    specialty: ['', [Validators.required, Validators.minLength(2)]],
    active: [true]
  });

  async saveEvaluator(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: Evaluator = {
      name: value.name.trim(),
      email: value.email.trim(),
      specialty: value.specialty.trim(),
      active: value.active
    };

    const editingId = this.editingId();
    if (editingId) {
      await this.evaluatorsService.update(editingId, payload);
      this.toastr.success('Registro actualizado exitosamente');
    } else {
      await this.evaluatorsService.create(payload);
      this.toastr.success('Registro creado exitosamente');
    }

    this.resetForm();
  }

  editEvaluator(evaluator: Evaluator): void {
    if (!evaluator.id) {
      return;
    }

    this.editingId.set(evaluator.id);
    this.form.patchValue({
      name: evaluator.name,
      email: evaluator.email,
      specialty: evaluator.specialty,
      active: evaluator.active
    });
  }

  async removeEvaluator(id: string): Promise<void> {
    const confirmed = window.confirm('¿Seguro que deseas eliminar este evaluador?');
    if (!confirmed) {
      return;
    }

    try {
      await this.evaluatorsService.remove(id);
      if (this.editingId() === id) {
        this.resetForm();
      }
    } catch (error: any) {
      alert(error.message || 'Error al eliminar el evaluador');
    }
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      email: '',
      specialty: '',
      active: true
    });
  }
}
