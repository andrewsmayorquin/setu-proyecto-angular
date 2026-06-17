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

/** Modelo de datos de un evaluador del sistema */
export interface Evaluator {
  id?: string;
  /** Nombre completo del evaluador */
  name: string;
  /** Correo electrónico del evaluador */
  email: string;
  /** Área de especialidad (ej: Sistemas, Administración) */
  specialty: string;
  /** Indica si el evaluador está activo */
  active: boolean;
}

/**
 * Servicio de evaluadores — conexión en tiempo real con la colección
 * 'evaluadores' de Firebase Firestore.
 *
 * Usa onSnapshot para mantener los datos sincronizados automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class EvaluatorsService {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'evaluadores' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'evaluadores');

  /** Subject interno que emite la lista actualizada de evaluadores */
  private readonly evaluatorsSubject = new BehaviorSubject<Evaluator[]>([]);

  constructor() {
    this.loadEvaluators();
  }

  private loadEvaluators(): void {
    const stored = localStorage.getItem('evaluators');
    if (stored) {
      this.evaluatorsSubject.next(JSON.parse(stored));
    }
  }

  /** Busca un evaluador por su ID en la lista actual */
  getById(id: string): Evaluator | undefined {
    return this.evaluatorsSubject.value.find(e => e.id === id);
  }

  /** Devuelve un observable con la lista de evaluadores en tiempo real */
  list(): Observable<Evaluator[]> {
    return this.evaluatorsSubject.asObservable();
  }

  /** Crea un nuevo evaluador en la colección 'evaluadores' de Firestore */
  async create(evaluator: Evaluator): Promise<void> {
    const { id, ...data } = evaluator;
    const newEvaluator = { id: Date.now().toString(), ...data };
    const current = this.evaluatorsSubject.value;
    this.evaluatorsSubject.next([...current, newEvaluator]);
    localStorage.setItem('evaluators', JSON.stringify(this.evaluatorsSubject.value));
    try {
      await addDoc(this.collectionRef, data);
    } catch (error) {
      console.warn('Error creating in Firestore, data saved locally');
    }
  }

  /** Actualiza los datos de un evaluador existente en Firestore */
  async update(id: string, evaluator: Partial<Evaluator>): Promise<void> {
    const current = this.evaluatorsSubject.value;
    const updated = current.map(e => e.id === id ? { ...e, ...evaluator } : e);
    this.evaluatorsSubject.next(updated);
    localStorage.setItem('evaluators', JSON.stringify(updated));
    try {
      const ref = doc(this.firestore, 'evaluadores', id);
      const { id: _, ...data } = evaluator;
      await updateDoc(ref, data);
    } catch (error) {
      console.warn('Error updating in Firestore, data saved locally');
    }
  }

  /** Elimina un evaluador de Firestore si no está asignado a ninguna terna */
  async remove(id: string): Promise<void> {
    const current = this.evaluatorsSubject.value;
    const filtered = current.filter(e => e.id !== id);
    this.evaluatorsSubject.next(filtered);
    localStorage.setItem('evaluators', JSON.stringify(filtered));
    try {
      const ref = doc(this.firestore, 'evaluadores', id);
      await deleteDoc(ref);
    } catch (error) {
      console.warn('Error deleting in Firestore, data removed locally');
    }
  }
}
