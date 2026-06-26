import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from '@angular/fire/firestore';
import { DataModeService } from './data-mode.service';
import { LocalDbService } from './local-db.service';

export interface Evaluator {
  id?: string;
  name: string;
  email: string;
  specialty: string;
  username: string;
  password: string;
  role: 'evaluador';
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class EvaluatorsService implements OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly dataMode = inject(DataModeService);
  private readonly localDb = inject(LocalDbService);
  private readonly collectionName = 'evaluadores';
  private readonly collectionRef = collection(this.firestore, this.collectionName);
  private readonly evaluatorsSubject: BehaviorSubject<Evaluator[]> = this.localDb.subject<Evaluator>(this.collectionName);
  private unsubscribe: () => void = () => {};

  constructor() {
    if (!this.dataMode.isLocal) {
      this.initFirestore();
    }
  }

  private initFirestore(): void {
    const q = query(this.collectionRef, orderBy('name'));

    getDocs(q).then((snap: any) => {
      const items: Evaluator[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Evaluator));
      if (items.length > 0) {
        const local = this.evaluatorsSubject.value;
        const firestoreIds = new Set(items.map(e => e.id));
        const onlyLocal = local.filter(e => e.id && !firestoreIds.has(e.id));
        const merged = [...items, ...onlyLocal];
        this.evaluatorsSubject.next(merged);
        localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
      }
    }).catch(() => {});

    this.unsubscribe = onSnapshot(q,
      (snapshot: any) => {
        const items: Evaluator[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Evaluator));
        const local = this.evaluatorsSubject.value;
        const firestoreIds = new Set(items.map(e => e.id));
        const onlyLocal = local.filter(e => e.id && !firestoreIds.has(e.id));
        const merged = [...items, ...onlyLocal];
        this.evaluatorsSubject.next(merged);
        if (items.length > 0 || local.length === 0) {
          localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
        }
      },
      () => {}
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  list(): Observable<Evaluator[]> {
    return this.evaluatorsSubject.asObservable();
  }

  getById(id: string): Evaluator | undefined {
    return this.evaluatorsSubject.value.find(evaluator => evaluator.id === id);
  }

  currentList(): Evaluator[] {
    return this.evaluatorsSubject.value;
  }

  async create(evaluator: Evaluator): Promise<void> {
    const { id, ...data } = evaluator;

    if (this.dataMode.isLocal) {
      const newEvaluator: Evaluator = { ...data, id: id ?? crypto.randomUUID() };
      this.localDb.save(this.collectionName, this.evaluatorsSubject, [...this.evaluatorsSubject.value, newEvaluator]);
      return;
    }

    // Optimistic update with temp ID — replaced with real Firestore ID after addDoc resolves.
    const tempId = crypto.randomUUID();
    const withTemp = [...this.evaluatorsSubject.value, { ...data, id: tempId }];
    this.evaluatorsSubject.next(withTemp);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(withTemp));

    const docRef = await addDoc(this.collectionRef, data);
    const withReal = withTemp.map(e => e.id === tempId ? { ...e, id: docRef.id } : e);
    this.evaluatorsSubject.next(withReal);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(withReal));
  }

  async update(id: string, evaluator: Partial<Evaluator>): Promise<void> {
    const { id: _, ...data } = evaluator;

    if (this.dataMode.isLocal) {
      const evaluators = this.evaluatorsSubject.value.map(item => item.id === id ? { ...item, ...data, id } : item);
      this.localDb.save(this.collectionName, this.evaluatorsSubject, evaluators);
      return;
    }

    const updated = this.evaluatorsSubject.value.map(e => e.id === id ? { ...e, ...data } : e);
    this.evaluatorsSubject.next(updated);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(updated));
    await updateDoc(doc(this.firestore, this.collectionName, id), data);
  }

  async remove(id: string): Promise<void> {
    if (this.dataMode.isLocal) {
      const teams = this.localDb.load<{ evaluatorIds?: string[] }>('ternas');
      const isReferenced = teams.some(team => team.evaluatorIds?.includes(id));
      if (isReferenced) throw new Error('No se puede eliminar: el evaluador está asignado a una o más ternas');

      const evaluators = this.evaluatorsSubject.value.filter(evaluator => evaluator.id !== id);
      this.localDb.save(this.collectionName, this.evaluatorsSubject, evaluators);
      return;
    }

    const teamsCol = collection(this.firestore, 'ternas');
    const snap = await getDocs(teamsCol);
    const isReferenced = snap.docs.some((d: any) => {
      const teamData = d.data() as { evaluatorIds?: string[] };
      return teamData.evaluatorIds?.includes(id);
    });

    if (isReferenced) throw new Error('No se puede eliminar: el evaluador está asignado a una o más ternas');

    const filtered = this.evaluatorsSubject.value.filter(e => e.id !== id);
    this.evaluatorsSubject.next(filtered);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(filtered));
    await deleteDoc(doc(this.firestore, this.collectionName, id));
  }
}
