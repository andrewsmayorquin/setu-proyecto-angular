import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe
} from '@angular/fire/firestore';

/** Modelo de datos de un resultado de evaluación */
export interface Result {
  id?: string;
  teamId: string;
  teamName: string;
  studentId: string;
  score: number;
  createdAt?: string;
}

/**
 * Servicio de resultados — conexión en tiempo real con la colección
 * 'resultados' de Firebase Firestore.
 *
 * Usa onSnapshot para mantener los datos sincronizados automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class ResultsService implements OnDestroy {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'resultados' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'resultados');

  /** Subject interno que emite la lista actualizada de resultados */
  private readonly resultsSubject = new BehaviorSubject<Result[]>([]);

  /** Función para cancelar la suscripción a onSnapshot */
  private unsubscribe: Unsubscribe;

  constructor() {
    // Escucha cambios en tiempo real de la colección 'resultados'
    const q = query(this.collectionRef, orderBy('createdAt'));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const results: Result[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Result));
      this.resultsSubject.next(results);
    });
  }

  ngOnDestroy(): void {
    // Cancela la suscripción a Firestore al destruir el servicio
    this.unsubscribe();
  }

  /** Lista de resultados */
  list(): Observable<Result[]> {
    return this.resultsSubject.asObservable();
  }

  /** Crear resultados iniciales para estudiantes de una terna */
  async createForTeam(teamId: string, teamName: string, studentIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    // Guardar cada resultado como un documento en la colección 'resultados'
    const promises = studentIds.map(studentId =>
      addDoc(this.collectionRef, {
        teamId,
        teamName,
        studentId,
        score: 0,
        createdAt: now
      })
    );
    await Promise.all(promises);
  }
}
