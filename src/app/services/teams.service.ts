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

export type TeamStatus = 'completed' | 'pending';

export interface EvaluationCriterion {
  id: string;
  name: string;
  weight: number;  // percentage 0–100; all criteria weights must sum to 100
  maxScore: number; // e.g. 10 — evaluator scores 0..maxScore per criterion
}

export const DEFAULT_CRITERIA: EvaluationCriterion[] = [
  { id: 'c1', name: 'Dominio del tema',       weight: 25, maxScore: 10 },
  { id: 'c2', name: 'Presentación',            weight: 20, maxScore: 10 },
  { id: 'c3', name: 'Uso de recursos',         weight: 20, maxScore: 10 },
  { id: 'c4', name: 'Respuesta a preguntas',   weight: 20, maxScore: 10 },
  { id: 'c5', name: 'Conclusiones',            weight: 15, maxScore: 10 },
];

export interface Team {
  id?: string;
  name: string;
  date: string;
  hora: string;          // time of the evaluation session
  aula: string;          // room / location
  weight: number;        // terna's contribution to final grade (e.g. 40 → scores shown /40)
  criteria: EvaluationCriterion[];
  studentsCount: number;
  studentIds: string[];
  evaluatorIds: string[];
  /** Auto-assigned: maps evaluatorId → studentId[] */
  evaluatorStudentMap: Record<string, string[]>;
  status: TeamStatus;
  resultsGenerated?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TeamsService implements OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly dataMode = inject(DataModeService);
  private readonly localDb = inject(LocalDbService);
  private readonly collectionName = 'ternas';
  private readonly collectionRef = collection(this.firestore, this.collectionName);
  private readonly teamsSubject: BehaviorSubject<Team[]> = this.localDb.subject<Team>(this.collectionName);
  private unsubscribe: () => void = () => {};

  constructor() {
    if (!this.dataMode.isLocal) {
      this.initFirestore();
    }
  }

  private initFirestore(): void {
    const q = query(this.collectionRef, orderBy('date'));

    getDocs(q).then((snap: any) => {
      const items: Team[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Team));
      if (items.length > 0) {
        const local = this.teamsSubject.value;
        const firestoreIds = new Set(items.map(t => t.id));
        const onlyLocal = local.filter(t => t.id && !firestoreIds.has(t.id));
        const merged = [...items, ...onlyLocal];
        this.teamsSubject.next(merged);
        localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
      }
    }).catch(() => {});

    this.unsubscribe = onSnapshot(q,
      (snapshot: any) => {
        const items: Team[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Team));
        const local = this.teamsSubject.value;
        const firestoreIds = new Set(items.map(t => t.id));
        const onlyLocal = local.filter(t => t.id && !firestoreIds.has(t.id));
        const merged = [...items, ...onlyLocal];
        this.teamsSubject.next(merged);
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

  list(): Observable<Team[]> {
    return this.teamsSubject.asObservable();
  }

  getById(id: string): Team | undefined {
    return this.teamsSubject.value.find(t => t.id === id);
  }

  async create(team: Team): Promise<{ id: string }> {
    const { id, ...data } = team;

    if (this.dataMode.isLocal) {
      const newTeam: Team = { ...data, id: id ?? crypto.randomUUID() };
      this.localDb.save(this.collectionName, this.teamsSubject, [...this.teamsSubject.value, newTeam]);
      return { id: newTeam.id ?? '' };
    }

    const created = await addDoc(this.collectionRef, data);
    if (!this.teamsSubject.value.find(t => t.id === created.id)) {
      const updated = [...this.teamsSubject.value, { ...data, id: created.id }];
      this.teamsSubject.next(updated);
      localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(updated));
    }
    return { id: created.id };
  }

  async update(id: string, team: Partial<Team>): Promise<void> {
    const { id: _, ...data } = team;

    if (this.dataMode.isLocal) {
      const teams = this.teamsSubject.value.map(item => item.id === id ? { ...item, ...data, id } : item);
      this.localDb.save(this.collectionName, this.teamsSubject, teams);
      return;
    }

    const updated = this.teamsSubject.value.map(item => item.id === id ? { ...item, ...data } : item);
    this.teamsSubject.next(updated);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(updated));
    await updateDoc(doc(this.firestore, this.collectionName, id), data);
  }

  async remove(id: string): Promise<void> {
    if (this.dataMode.isLocal) {
      const teams = this.teamsSubject.value.filter(team => team.id !== id);
      this.localDb.save(this.collectionName, this.teamsSubject, teams);
      return;
    }

    const filtered = this.teamsSubject.value.filter(t => t.id !== id);
    this.teamsSubject.next(filtered);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(filtered));
    await deleteDoc(doc(this.firestore, this.collectionName, id));
  }
}
