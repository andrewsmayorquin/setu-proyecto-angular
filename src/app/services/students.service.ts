import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe
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
export class StudentsService implements OnDestroy {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'estudiantes' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'estudiantes');

  /** Subject interno que emite la lista actualizada de estudiantes */
  private readonly studentsSubject = new BehaviorSubject<Student[]>([]);

  /** Función para cancelar la suscripción a onSnapshot */
  private unsubscribe: Unsubscribe;

  constructor() {
    // Escucha cambios en tiempo real de la colección 'estudiantes'
    const q = query(this.collectionRef, orderBy('name'));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const students: Student[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Student));
      this.studentsSubject.next(students);
    });
  }

  ngOnDestroy(): void {
    // Cancela la suscripción a Firestore al destruir el servicio
    this.unsubscribe();
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
    await addDoc(this.collectionRef, data);
  }

  /** Actualiza los datos de un estudiante existente en Firestore */
  async update(id: string, student: Partial<Student>): Promise<void> {
    const ref = doc(this.firestore, 'estudiantes', id);
    const { id: _, ...data } = student;
    await updateDoc(ref, data);
  }

  /** Elimina un estudiante de Firestore si no está asignado a ninguna terna */
  async remove(id: string): Promise<void> {
    // Verificar si el estudiante está referenciado en alguna terna
    const teamsCol = collection(this.firestore, 'ternas');
    const snap = await getDocs(teamsCol);
    const isReferenced = snap.docs.some(d => {
      const data = d.data() as { studentIds?: string[] };
      return data.studentIds?.includes(id);
    });

    if (isReferenced) {
      throw new Error('No se puede eliminar: el estudiante está asignado a una o más ternas');
    }

    const ref = doc(this.firestore, 'estudiantes', id);
    await deleteDoc(ref);
  }
}
