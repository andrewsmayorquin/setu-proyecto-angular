import { Injectable, inject, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe
} from '@angular/fire/firestore';

/** Estados posibles de una terna */
export type TeamStatus = 'completed' | 'pending';

/** Modelo de datos de una terna (grupo de evaluación) */
export interface Team {
  id?: string;
  /** Nombre descriptivo de la terna */
  name: string;
  /** Fecha programada de la evaluación */
  date: string;
  /** Cantidad de estudiantes asignados */
  studentsCount: number;
  /** IDs de los estudiantes asignados a esta terna */
  studentIds: string[];
  /** IDs de los evaluadores asignados a esta terna */
  evaluatorIds: string[];
  /** Estado actual de la terna */
  status: TeamStatus;
  /** Indica si ya se generaron resultados para esta terna */
  resultsGenerated?: boolean;
}

/**
 * Servicio de ternas — conexión en tiempo real con la colección
 * 'ternas' de Firebase Firestore.
 *
 * Usa onSnapshot para mantener los datos sincronizados automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class TeamsService implements OnDestroy {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'ternas' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'ternas');

  /** Subject interno que emite la lista actualizada de ternas */
  private readonly teamsSubject = new BehaviorSubject<Team[]>([]);

  /** Función para cancelar la suscripción a onSnapshot */
  private unsubscribe: Unsubscribe;

  constructor() {
    // Escucha cambios en tiempo real de la colección 'ternas'
    const q = query(this.collectionRef, orderBy('name'));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const teams: Team[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Team));
      this.teamsSubject.next(teams);
    });
  }

  ngOnDestroy(): void {
    // Cancela la suscripción a Firestore al destruir el servicio
    this.unsubscribe();
  }

  /** Devuelve un observable con la lista de ternas en tiempo real */
  list(): Observable<Team[]> {
    return this.teamsSubject.asObservable();
  }

  /** Crea una nueva terna en Firestore y devuelve su ID generado */
  async create(team: Team): Promise<{ id: string }> {
    const { id, ...data } = team;
    const ref = await addDoc(this.collectionRef, data);
    return { id: ref.id };
  }

  /** Actualiza los datos de una terna existente en Firestore */
  async update(id: string, team: Partial<Team>): Promise<void> {
    const ref = doc(this.firestore, 'ternas', id);
    const { id: _, ...data } = team;
    await updateDoc(ref, data);
  }

  /** Elimina una terna de Firestore */
  async remove(id: string): Promise<void> {
    const ref = doc(this.firestore, 'ternas', id);
    await deleteDoc(ref);
  }
}
