import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Estados posibles de una terna */
export type TeamStatus = 'completed' | 'pending';

/** Modelo de datos de una terna */
export interface Team {
  id?: string;
  name: string;
  date: string;
  studentsCount: number;
  studentIds: string[];
  evaluatorIds: string[];
  status: TeamStatus;
  resultsGenerated?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TeamsService {

  private readonly storageKey = 'setu_teams';

  private readonly teamsSubject = new BehaviorSubject<Team[]>(
    this.loadTeams()
  );

  /** Lista de ternas */
  list(): Observable<Team[]> {
    return this.teamsSubject.asObservable();
  }

  /** Crear terna */
  async create(team: Team): Promise<{ id: string }> {

    const id = crypto.randomUUID();

    const newTeam: Team = {
      ...team,
      id
    };

    const teams = [...this.teamsSubject.value, newTeam];

    this.saveTeams(teams);

    return { id };
  }

  /** Actualizar terna */
  async update(id: string, team: Partial<Team>): Promise<void> {

    const teams = this.teamsSubject.value.map(item =>
      item.id === id
        ? {
            ...item,
            ...team,
            id
          }
        : item
    );

    this.saveTeams(teams);
  }

  /** Eliminar terna */
  async remove(id: string): Promise<void> {

    const teams = this.teamsSubject.value.filter(
      team => team.id !== id
    );

    this.saveTeams(teams);
  }

  /** Cargar ternas */
  private loadTeams(): Team[] {

    const data = localStorage.getItem(this.storageKey);

    if (!data) {
      return [];
    }

    try {
      return JSON.parse(data) as Team[];
    } catch {
      return [];
    }
  }

  /** Guardar ternas */
  private saveTeams(teams: Team[]): void {

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(teams)
    );

    this.teamsSubject.next(teams);
  }
}