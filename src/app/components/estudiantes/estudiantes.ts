import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Student, StudentsService } from '../../services/students.service';
import { TippyDirective } from '../../directives/tippy.directive';
import { SidebarComponent } from '../sidebar/sidebar';

/**
 * Componente de gestión de estudiantes.
 * Permite crear, editar, eliminar y buscar estudiantes.
 * Los datos se persisten en la colección 'estudiantes' de Firestore
 * y se actualizan en tiempo real mediante onSnapshot.
 */
@Component({
  selector: 'app-estudiantes',
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SidebarComponent, TippyDirective]
})
export class EstudiantesComponent {
  private readonly studentsService = inject(StudentsService);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  private readonly studentsSignal = toSignal(this.studentsService.list(), { initialValue: [] });
  readonly search = signal('');
  readonly programFilter = signal('todos');

  readonly students = computed(() => {
    const term = this.search().trim().toLowerCase();
    const filter = this.programFilter();

    return this.studentsSignal().filter(student => {
      const matchesTerm =
        !term ||
        student.name.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.program.toLowerCase().includes(term) ||
        (student.id ?? '').toLowerCase().includes(term);

      const matchesProgram = filter === 'todos' || student.program === filter;

      return matchesTerm && matchesProgram;
    });
  });

  readonly editingId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editingId() !== null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    program: ['', [Validators.required, Validators.minLength(2)]]
  });

  async saveStudent(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: Student = {
      name: value.name.trim(),
      email: value.email.trim(),
      program: value.program.trim()
    };

    const editingId = this.editingId();
    if (editingId) {
      await this.studentsService.update(editingId, payload);
      this.toastr.success('Registro actualizado exitosamente');
    } else {
      await this.studentsService.create(payload);
      this.toastr.success('Registro creado exitosamente');
    }

    this.resetForm();
  }

  editStudent(student: Student): void {
    if (!student.id) {
      return;
    }

    this.editingId.set(student.id);
    this.form.patchValue({
      name: student.name,
      email: student.email,
      program: student.program
    });
  }

  async removeStudent(id: string): Promise<void> {
    const confirmed = window.confirm('¿Seguro que deseas eliminar este estudiante?');
    if (!confirmed) {
      return;
    }

    try {
      await this.studentsService.remove(id);
      if (this.editingId() === id) {
        this.resetForm();
      }
    } catch (error: any) {
      alert(error.message || 'Error al eliminar el estudiante');
    }
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  setProgram(value: string): void {
    this.programFilter.set(value);
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      email: '',
      program: ''
    });
  }
}
