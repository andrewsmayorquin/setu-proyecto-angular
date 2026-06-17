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

/** Modelo de datos de un evaluador del sistema */
export interface Evaluator {
  id?: string;

  /** Nombre completo del evaluador */
  name: string;

  /** Correo electrónico del evaluador */
  email: string;

  /** Área de especialidad */
  specialty: string;

  /** Usuario para iniciar sesión */
  username: string;

  /** Contraseña para iniciar sesión */
  password: string;

  /** Rol del usuario */
  role: 'evaluador';

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
export class EvaluatorsService implements OnDestroy {
  private readonly firestore = inject(Firestore);

  /** Referencia a la colección 'evaluadores' en Firestore */
  private readonly collectionRef = collection(this.firestore, 'evaluadores');

  /** Subject interno que emite la lista actualizada de evaluadores */
  private readonly evaluatorsSubject = new BehaviorSubject<Evaluator[]>([]);

  /** Función para cancelar la suscripción a onSnapshot */
  private unsubscribe: Unsubscribe;

  constructor() {
    // Escucha cambios en tiempo real de la colección 'evaluadores'
    const q = query(this.collectionRef, orderBy('name'));
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const evaluators: Evaluator[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as Evaluator));
      this.evaluatorsSubject.next(evaluators);
    });
  }

  ngOnDestroy(): void {
    // Cancela la suscripción a Firestore al destruir el servicio
    this.unsubscribe();
  }

  /** Busca un evaluador por su ID */
  getById(id: string): Evaluator | undefined {
    return this.evaluatorsSubject.value.find(
      evaluator => evaluator.id === id
    );
  }

  /** Lista de evaluadores */
  list(): Observable<Evaluator[]> {
    return this.evaluatorsSubject.asObservable();
  }

  /** Crear evaluador */
  async create(evaluator: Evaluator): Promise<void> {
    const { id, ...data } = evaluator;
    await addDoc(this.collectionRef, data);
  }

  /** Actualiza los datos de un evaluador existente en Firestore */
  async update(id: string, evaluator: Partial<Evaluator>): Promise<void> {
    const ref = doc(this.firestore, 'evaluadores', id);
    const { id: _, ...data } = evaluator;
    await updateDoc(ref, data);
  }

  /** Elimina un evaluador de Firestore si no está asignado a ninguna terna */
  async remove(id: string): Promise<void> {
    // Verificar si el evaluador está referenciado en alguna terna
    const teamsCol = collection(this.firestore, 'ternas');
    const snap = await getDocs(teamsCol);
    const isReferenced = snap.docs.some(d => {
      const data = d.data() as { evaluatorIds?: string[] };
      return data.evaluatorIds?.includes(id);
    });

    if (isReferenced) {
      throw new Error('No se puede eliminar: el evaluador está asignado a una o más ternas');
    }

    const ref = doc(this.firestore, 'evaluadores', id);
    await deleteDoc(ref);
  }
}