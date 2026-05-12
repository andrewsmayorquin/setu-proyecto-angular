import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Student, StudentsService } from '../../services/students.service';

@Component({
  selector: 'app-services',
  templateUrl: './services.html',
  styleUrl: './services.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AsyncPipe]
})
export class ServicesComponent {
  private readonly studentsService = inject(StudentsService);
  private readonly fb = inject(FormBuilder);

  readonly students$ = this.studentsService.list();
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
    } else {
      await this.studentsService.create(payload);
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
    await this.studentsService.remove(id);
    if (this.editingId() === id) {
      this.resetForm();
    }
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
