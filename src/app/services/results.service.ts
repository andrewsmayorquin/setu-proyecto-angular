import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Modelo de datos de un resultado de evaluación */
export interface Result {
  id?: string;
  teamId: string;
  teamName: string;
  studentId: string;
  score: number;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResultsService {

  private readonly storageKey = 'setu_results';

  private readonly resultsSubject = new BehaviorSubject<Result[]>(
    this.loadResults()
  );

  /** Lista de resultados */
  list(): Observable<Result[]> {
    return this.resultsSubject.asObservable();
  }

  /** Crear resultados iniciales para estudiantes de una terna */
  async createForTeam(teamId: string, teamName: string, studentIds: string[]): Promise<void> {
    const now = new Date().toISOString();

    const currentResults = this.resultsSubject.value;

    const newResults: Result[] = studentIds.map(studentId => ({
      id: crypto.randomUUID(),
      teamId,
      teamName,
      studentId,
      score: 0,
      createdAt: now
    }));

    this.saveResults([...currentResults, ...newResults]);
  }

  /** Actualizar nota de un estudiante */
  async updateScore(resultId: string, score: number): Promise<void> {
    const updatedResults = this.resultsSubject.value.map(result =>
      result.id === resultId
        ? { ...result, score }
        : result
    );

    this.saveResults(updatedResults);
  }

  /** Cargar resultados desde localStorage */
  private loadResults(): Result[] {
    const data = localStorage.getItem(this.storageKey);

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as Result[];
    } catch {
      return [];
    }
  }

  /** Guardar resultados en localStorage */
  private saveResults(results: Result[]): void {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(results)
    );

    this.resultsSubject.next(results);
  }
}