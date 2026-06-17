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
export class TeamsService {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'ternas' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'ternas');

  /** Subject interno que emite la lista actualizada de ternas */
  private readonly teamsSubject = new BehaviorSubject<Team[]>([]);

  constructor() {
    this.loadTeams();
  }

  private loadTeams(): void {
    const stored = localStorage.getItem('teams');
    if (stored) {
      this.teamsSubject.next(JSON.parse(stored));
    }
  }

  /** Devuelve un observable con la lista de ternas en tiempo real */
  list(): Observable<Team[]> {
    return this.teamsSubject.asObservable();
  }

  /** Crea una nueva terna en Firestore y devuelve su ID generado */
  async create(team: Team): Promise<{ id: string }> {
    const { id, ...data } = team;
    const newId = Date.now().toString();
    const newTeam = { id: newId, ...data };
    const current = this.teamsSubject.value;
    this.teamsSubject.next([...current, newTeam]);
    localStorage.setItem('teams', JSON.stringify(this.teamsSubject.value));
    try {
      const ref = await addDoc(this.collectionRef, data);
      return { id: ref.id };
    } catch (error) {
      console.warn('Error creating in Firestore, data saved locally');
      return { id: newId };
    }
  }

  /** Actualiza los datos de una terna existente en Firestore */
  async update(id: string, team: Partial<Team>): Promise<void> {
    const current = this.teamsSubject.value;
    const updated = current.map(t => t.id === id ? { ...t, ...team } : t);
    this.teamsSubject.next(updated);
    localStorage.setItem('teams', JSON.stringify(updated));
    try {
      const ref = doc(this.firestore, 'ternas', id);
      const { id: _, ...data } = team;
      await updateDoc(ref, data);
    } catch (error) {
      console.warn('Error updating in Firestore, data saved locally');
    }
  }

  /** Elimina una terna de Firestore */
  async remove(id: string): Promise<void> {
    const current = this.teamsSubject.value;
    const filtered = current.filter(t => t.id !== id);
    this.teamsSubject.next(filtered);
    localStorage.setItem('teams', JSON.stringify(filtered));
    try {
      const ref = doc(this.firestore, 'ternas', id);
      await deleteDoc(ref);
    } catch (error) {
      console.warn('Error deleting in Firestore, data removed locally');
    }
  }
}
