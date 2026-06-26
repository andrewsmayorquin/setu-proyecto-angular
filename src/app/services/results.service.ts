import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from '@angular/fire/firestore';
import { DataModeService } from './data-mode.service';
import { LocalDbService } from './local-db.service';

export interface Result {
  id?: string;
  teamId: string;
  teamName: string;
  studentId: string;
  score: number;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ResultsService implements OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly dataMode = inject(DataModeService);
  private readonly localDb = inject(LocalDbService);
  private readonly collectionName = 'resultados';
  private readonly collectionRef = collection(this.firestore, this.collectionName);
  private readonly resultsSubject: BehaviorSubject<Result[]> = this.localDb.subject<Result>(this.collectionName);
  private unsubscribe: () => void = () => {};

  constructor() {
    if (!this.dataMode.isLocal) {
      const q = query(this.collectionRef, orderBy('createdAt'));
      this.unsubscribe = onSnapshot(q, (snapshot: any) => {
        const results: Result[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Result));
        this.resultsSubject.next(results);
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  list(): Observable<Result[]> {
    return this.resultsSubject.asObservable();
  }

  async createForTeam(teamId: string, teamName: string, studentIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const newResults = studentIds.map(studentId => ({ teamId, teamName, studentId, score: 0, createdAt: now }));

    if (this.dataMode.isLocal) {
      const localResults: Result[] = newResults.map(result => ({ ...result, id: crypto.randomUUID() }));
      this.localDb.save(this.collectionName, this.resultsSubject, [...this.resultsSubject.value, ...localResults]);
      return;
    }

    await Promise.all(newResults.map(result => addDoc(this.collectionRef, result)));
  }

  async updateScore(id: string, score: number): Promise<void> {
    if (this.dataMode.isLocal) {
      const results = this.resultsSubject.value.map(item => item.id === id ? { ...item, score } : item);
      this.localDb.save(this.collectionName, this.resultsSubject, results);
      return;
    }

    await updateDoc(doc(this.firestore, this.collectionName, id), { score });
  }
}
