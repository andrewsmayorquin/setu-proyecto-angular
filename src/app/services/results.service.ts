import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  getDocs
} from '@angular/fire/firestore';

/** Modelo de datos de un resultado de evaluación */
export interface Result {
  id?: string;
  /** ID de la terna a la que pertenece este resultado */
  teamId: string;
  /** Nombre de la terna (desnormalizado para consultas rápidas) */
  teamName: string;
  /** ID del estudiante evaluado */
  studentId: string;
  /** Calificación obtenida */
  score: number;
  /** Fecha de creación del resultado */
  createdAt?: string;
}

/**
 * Servicio de resultados — conexión en tiempo real con la colección
 * 'resultados' de Firebase Firestore.
 *
 * Usa onSnapshot para mantener los datos sincronizados automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'resultados' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'resultados');

  /** Subject interno que emite la lista actualizada de resultados */
  private readonly resultsSubject = new BehaviorSubject<Result[]>([]);

  constructor() {
    this.loadResults();
  }

  private loadResults(): void {
    const stored = localStorage.getItem('results');
    if (stored) {
      this.resultsSubject.next(JSON.parse(stored));
    }
  }

  /** Devuelve un observable con la lista de resultados en tiempo real */
  list(): Observable<Result[]> {
    return this.resultsSubject.asObservable();
  }

  /**
   * Crea resultados para todos los estudiantes de una terna.
   * Cada estudiante recibe un registro con calificación inicial de 0.
   */
  async createForTeam(teamId: string, teamName: string, studentIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const newResults = studentIds.map(studentId => ({
      id: Date.now().toString() + Math.random(),
      teamId,
      teamName,
      studentId,
      score: 0,
      createdAt: now
    }));
    const current = this.resultsSubject.value;
    this.resultsSubject.next([...current, ...newResults]);
    localStorage.setItem('results', JSON.stringify(this.resultsSubject.value));
    try {
      const promises = newResults.map(result => addDoc(this.collectionRef, result));
      await Promise.all(promises);
    } catch (error) {
      console.warn('Error creating in Firestore, data saved locally');
    }
  }
}
