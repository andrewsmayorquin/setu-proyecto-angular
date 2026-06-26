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

export interface Student {
  id?: string;
  name: string;
  email: string;
  program: string;
}

@Injectable({ providedIn: 'root' })
export class StudentsService implements OnDestroy {
  private readonly firestore = inject(Firestore);
  private readonly dataMode = inject(DataModeService);
  private readonly localDb = inject(LocalDbService);
  private readonly collectionName = 'estudiantes';
  private readonly collectionRef = collection(this.firestore, this.collectionName);
  private readonly studentsSubject: BehaviorSubject<Student[]> = this.localDb.subject<Student>(this.collectionName);
  private unsubscribe: () => void = () => {};

  constructor() {
    if (!this.dataMode.isLocal) {
      this.initFirestore();
    }
  }

  private initFirestore(): void {
    const q = query(this.collectionRef, orderBy('name'));

    getDocs(q).then((snap: any) => {
      const items: Student[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));
      if (items.length > 0) {
        const local = this.studentsSubject.value;
        const firestoreIds = new Set(items.map(s => s.id));
        const onlyLocal = local.filter(s => s.id && !firestoreIds.has(s.id));
        const merged = [...items, ...onlyLocal];
        this.studentsSubject.next(merged);
        localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(merged));
      }
    }).catch(() => {});

    this.unsubscribe = onSnapshot(q,
      (snapshot: any) => {
        const items: Student[] = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as Student));
        const local = this.studentsSubject.value;
        const firestoreIds = new Set(items.map(s => s.id));
        const onlyLocal = local.filter(s => s.id && !firestoreIds.has(s.id));
        const merged = [...items, ...onlyLocal];
        this.studentsSubject.next(merged);
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

  list(): Observable<Student[]> {
    return this.studentsSubject.asObservable();
  }

  getById(id: string): Student | undefined {
    return this.studentsSubject.value.find(student => student.id === id);
  }

  async create(student: Student): Promise<void> {
    const { id, ...data } = student;

    if (this.dataMode.isLocal) {
      const newStudent: Student = { ...data, id: id ?? crypto.randomUUID() };
      this.localDb.save(this.collectionName, this.studentsSubject, [...this.studentsSubject.value, newStudent]);
      return;
    }

    // Optimistic update with temp ID — replaced with real Firestore ID after addDoc resolves.
    const tempId = crypto.randomUUID();
    const withTemp = [...this.studentsSubject.value, { ...data, id: tempId }];
    this.studentsSubject.next(withTemp);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(withTemp));

    const docRef = await addDoc(this.collectionRef, data);
    const withReal = withTemp.map(s => s.id === tempId ? { ...s, id: docRef.id } : s);
    this.studentsSubject.next(withReal);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(withReal));
  }

  async update(id: string, student: Partial<Student>): Promise<void> {
    const { id: _, ...data } = student;

    if (this.dataMode.isLocal) {
      const students = this.studentsSubject.value.map(item => item.id === id ? { ...item, ...data, id } : item);
      this.localDb.save(this.collectionName, this.studentsSubject, students);
      return;
    }

    const updated = this.studentsSubject.value.map(s => s.id === id ? { ...s, ...data } : s);
    this.studentsSubject.next(updated);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(updated));
    await updateDoc(doc(this.firestore, this.collectionName, id), data);
  }

  async remove(id: string): Promise<void> {
    if (this.dataMode.isLocal) {
      const teams = this.localDb.load<{ studentIds?: string[] }>('ternas');
      const isReferenced = teams.some(team => team.studentIds?.includes(id));
      if (isReferenced) throw new Error('No se puede eliminar: el estudiante está asignado a una o más ternas');

      const students = this.studentsSubject.value.filter(student => student.id !== id);
      this.localDb.save(this.collectionName, this.studentsSubject, students);
      return;
    }

    const teamsCol = collection(this.firestore, 'ternas');
    const snap = await getDocs(teamsCol);
    const isReferenced = snap.docs.some((d: any) => {
      const teamData = d.data() as { studentIds?: string[] };
      return teamData.studentIds?.includes(id);
    });

    if (isReferenced) throw new Error('No se puede eliminar: el estudiante está asignado a una o más ternas');

    const filtered = this.studentsSubject.value.filter(s => s.id !== id);
    this.studentsSubject.next(filtered);
    localStorage.setItem(`setu_${this.collectionName}`, JSON.stringify(filtered));
    await deleteDoc(doc(this.firestore, this.collectionName, id));
  }
}
