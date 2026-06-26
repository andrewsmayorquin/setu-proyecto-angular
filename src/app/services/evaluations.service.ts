import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc
} from '@angular/fire/firestore';
import { DataModeService } from './data-mode.service';
import { LocalDbService } from './local-db.service';

export interface CriterionScore {
  criterionId: string;
  score: number;
}

export type EvaluationStatus = 'draft' | 'submitted';

export interface Evaluation {
  id?: string;
  ternaId: string;
  studentId: string;
  evaluatorId: string;
  criteriaScores: CriterionScore[];
  /** Weighted average 0–100 across all criteria */
  totalScore: number;
  status: EvaluationStatus;
  savedAt: string;
}

/** Builds the deterministic composite key used as the Firestore document ID. */
export function evaluationId(ternaId: string, studentId: string, evaluatorId: string): string {
  return `${ternaId}__${studentId}__${evaluatorId}`;
}

@Injectable({ providedIn: 'root' })
export class EvaluationsService implements OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly dataMode = inject(DataModeService);
  private readonly localDb = inject(LocalDbService);

  private readonly collectionName = 'evaluaciones';
  private readonly collectionRef = collection(this.firestore, this.collectionName);
  private readonly subject: BehaviorSubject<Evaluation[]> = this.localDb.subject<Evaluation>(this.collectionName);

  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: () => void = () => {};

  constructor() {
    if (!this.dataMode.isLocal) {
      this.initFirestore();
    }
  }

  private initFirestore(): void {
    const q = query(this.collectionRef, orderBy('savedAt'));

    // Try a one-time read first to load existing evaluations from Firestore.
    getDocs(q).then((snap: any) => {
      const evals: Evaluation[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Evaluation));
      if (evals.length > 0) {
        // Merge: keep any optimistic local records that aren't in Firestore yet.
        const local = this.subject.value;
        const firestoreIds = new Set(evals.map(e => e.id));
        const onlyLocal = local.filter(e => e.id && !firestoreIds.has(e.id));
        const merged = [...evals, ...onlyLocal];
        this.subject.next(merged);
        localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
      }
    }).catch(() => {
      // getDocs failed (security rules / offline) — use localStorage cache already in subject.
    });

    // Real-time listener for live updates.
    this.unsubscribe = onSnapshot(q,
      (snapshot: any) => {
        const evals: Evaluation[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Evaluation));
        // Merge Firestore data with any optimistic-only local records.
        const local = this.subject.value;
        const firestoreIds = new Set(evals.map(e => e.id));
        const onlyLocal = local.filter(e => e.id && !firestoreIds.has(e.id));
        const merged = [...evals, ...onlyLocal];
        this.subject.next(merged);
        // Only update localStorage when Firestore returns data.
        if (evals.length > 0 || local.length === 0) {
          localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
        }
      },
      () => {
        // onSnapshot failed — subject already has localStorage-cached data.
      }
    );
  }

  ngOnDestroy(): void {
    this.unsubscribe();
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  }

  list(): Observable<Evaluation[]> {
    return this.subject.asObservable();
  }

  /** Returns the current in-memory list synchronously. */
  currentList(): Evaluation[] {
    return this.subject.value;
  }

  /** Find an existing evaluation for the given composite key, if any. */
  find(ternaId: string, studentId: string, evaluatorId: string): Evaluation | undefined {
    const id = evaluationId(ternaId, studentId, evaluatorId);
    return this.subject.value.find(e => e.id === id);
  }

  /** Immediately persist an evaluation (upsert). */
  async save(evaluation: Omit<Evaluation, 'id'>): Promise<void> {
    const id = evaluationId(evaluation.ternaId, evaluation.studentId, evaluation.evaluatorId);
    const record: Evaluation = { ...evaluation, id };

    if (this.dataMode.isLocal) {
      const rest = this.subject.value.filter(e => e.id !== id);
      this.localDb.save(this.collectionName, this.subject, [...rest, record]);
      return;
    }

    // Optimistic update + local cache so data survives page refresh even if onSnapshot fails.
    const rest = this.subject.value.filter(e => e.id !== id);
    const updated = [...rest, record];
    this.subject.next(updated);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(updated));
    await setDoc(doc(this.collectionRef, id), { ...evaluation });
  }

  /**
   * Schedule an auto-save 2 seconds after the last change.
   * Cancels any pending save before scheduling a new one.
   */
  scheduleAutoSave(evaluation: Omit<Evaluation, 'id'>): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.save(evaluation), 2000);
  }
}
