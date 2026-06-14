import { Injectable, signal } from '@angular/core';

export type UserRole = 'admin' | 'evaluador';

export interface AuthSession {
  username: string;
  name: string;
  role: UserRole;
  evaluatorId?: string;
}

const STORAGE_KEY = 'setu-auth';
const EVALUATORS_KEY = 'setu_evaluators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<AuthSession | null>(this.loadSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = signal(!!this.sessionSignal());

  login(username: string, password: string): boolean {
    const cleanUsername = username.trim();

    if (cleanUsername === 'admin' && password === 'admin') {
      this.saveSession({
        username: 'admin',
        name: 'Administrador',
        role: 'admin'
      });

      return true;
    }

    const evaluators = this.loadEvaluators();

    const evaluator = evaluators.find((e: any) =>
      e.username === cleanUsername &&
      e.password === password &&
      e.active === true
    );

    if (evaluator) {
      this.saveSession({
        username: evaluator.username,
        name: evaluator.name,
        role: 'evaluador',
        evaluatorId: evaluator.id
      });

      return true;
    }

    this.logout();
    return false;
  }

  logout(): void {
    this.sessionSignal.set(null);
    this.isAuthenticated.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  getCurrentUser(): AuthSession | null {
    return this.sessionSignal();
  }

  getRole(): UserRole | null {
    return this.sessionSignal()?.role ?? null;
  }

  hasRole(role: UserRole): boolean {
    return this.getRole() === role;
  }

  private saveSession(session: AuthSession): void {
    this.sessionSignal.set(session);
    this.isAuthenticated.set(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private loadSession(): AuthSession | null {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return null;

    try {
      return JSON.parse(stored) as AuthSession;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private loadEvaluators(): any[] {
    const stored = localStorage.getItem(EVALUATORS_KEY);

    if (!stored) return [];

    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
}