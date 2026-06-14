import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Modelo de datos de un estudiante registrado en el sistema */
export interface Student {
  id?: string;
  /** Nombre completo del estudiante */
  name: string;
  /** Correo electrónico institucional */
  email: string;
  /** Programa académico al que pertenece */
  program: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentsService {

  private readonly storageKey = 'setu_students';

  private readonly studentsSubject = new BehaviorSubject<Student[]>(
    this.loadStudents()
  );

  constructor() {}

  /** Obtiene un estudiante por ID */
  getById(id: string): Student | undefined {
    return this.studentsSubject.value.find(student => student.id === id);
  }

  /** Lista de estudiantes */
  list(): Observable<Student[]> {
    return this.studentsSubject.asObservable();
  }

  /** Crear estudiante */
  async create(student: Student): Promise<void> {
    const students = this.studentsSubject.value;

    const newStudent: Student = {
      ...student,
      id: crypto.randomUUID()
    };

    const updatedStudents = [...students, newStudent];

    this.saveStudents(updatedStudents);
  }

  /** Actualizar estudiante */
  async update(id: string, student: Partial<Student>): Promise<void> {
    const students = this.studentsSubject.value;

    const updatedStudents = students.map(item =>
      item.id === id
        ? {
            ...item,
            ...student,
            id
          }
        : item
    );

    this.saveStudents(updatedStudents);
  }

  /** Eliminar estudiante */
  async remove(id: string): Promise<void> {
    const updatedStudents = this.studentsSubject.value.filter(
      student => student.id !== id
    );

    this.saveStudents(updatedStudents);
  }

  /** Cargar estudiantes desde localStorage */
  private loadStudents(): Student[] {
    const data = localStorage.getItem(this.storageKey);

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as Student[];
    } catch {
      return [];
    }
  }

  /** Guardar estudiantes en localStorage */
  private saveStudents(students: Student[]): void {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(students)
    );

    this.studentsSubject.next(students);
  }
}