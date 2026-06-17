import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from '@angular/fire/firestore';

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

/**
 * Servicio de estudiantes — conexión en tiempo real con la colección
 * 'estudiantes' de Firebase Firestore.
 *
 * Usa onSnapshot para mantener los datos sincronizados automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class StudentsService {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'estudiantes' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'estudiantes');

  /** Subject interno que emite la lista actualizada de estudiantes */
  private readonly studentsSubject = new BehaviorSubject<Student[]>([]);

  constructor() {
    this.loadStudents();
  }

  private loadStudents(): void {
    const stored = localStorage.getItem('students');
    if (stored) {
      this.studentsSubject.next(JSON.parse(stored));
    }
  }

  /** Busca un estudiante por su ID en la lista actual */
  getById(id: string): Student | undefined {
    return this.studentsSubject.value.find(s => s.id === id);
  }

  /** Devuelve un observable con la lista de estudiantes en tiempo real */
  list(): Observable<Student[]> {
    return this.studentsSubject.asObservable();
  }

  /** Crea un nuevo estudiante en la colección 'estudiantes' de Firestore */
  async create(student: Student): Promise<void> {
    const { id, ...data } = student;
    const newStudent = { id: Date.now().toString(), ...data };
    const current = this.studentsSubject.value;
    this.studentsSubject.next([...current, newStudent]);
    localStorage.setItem('students', JSON.stringify(this.studentsSubject.value));
    try {
      await addDoc(this.collectionRef, data);
    } catch (error) {
      console.warn('Error creating in Firestore, data saved locally');
    }
  }

  /** Actualiza los datos de un estudiante existente en Firestore */
  async update(id: string, student: Partial<Student>): Promise<void> {
    const current = this.studentsSubject.value;
    const updated = current.map(s => s.id === id ? { ...s, ...student } : s);
    this.studentsSubject.next(updated);
    localStorage.setItem('students', JSON.stringify(updated));
    try {
      const ref = doc(this.firestore, 'estudiantes', id);
      const { id: _, ...data } = student;
      await updateDoc(ref, data);
    } catch (error) {
      console.warn('Error updating in Firestore, data saved locally');
    }
  }

  /** Elimina un estudiante de Firestore si no está asignado a ninguna terna */
  async remove(id: string): Promise<void> {
    const current = this.studentsSubject.value;
    const filtered = current.filter(s => s.id !== id);
    this.studentsSubject.next(filtered);
    localStorage.setItem('students', JSON.stringify(filtered));
    try {
      const ref = doc(this.firestore, 'estudiantes', id);
      await deleteDoc(ref);
    } catch (error) {
      console.warn('Error deleting in Firestore, data removed locally');
    }
  }
}
