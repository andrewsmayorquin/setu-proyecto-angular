import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInAnonymously, signOut } from '@angular/fire/auth';
import { DataModeService } from './data-mode.service';
import { EvaluatorsService } from './evaluators.service';

export type UserRole = 'admin' | 'evaluador';

export interface AuthSession {
  username: string;
  name: string;
  role: UserRole;
  evaluatorId?: string;
}

const STORAGE_KEY = 'setu-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseAuth = inject(Auth);
  private readonly dataMode = inject(DataModeService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly sessionSignal = signal<AuthSession | null>(this.loadSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = signal(!!this.sessionSignal());

  async login(username: string, password: string): Promise<boolean> {
    const clean = username.trim();

    if (clean === 'admin' && password === 'admin') {
      await this.signIntoFirebase();
      this.saveSession({ username: 'admin', name: 'Administrador', role: 'admin' });
      return true;
    }

    // Look up evaluator from the Firestore-backed in-memory list.
    const evaluator = this.evaluatorsService
      .currentList()
      .find(e => e.username === clean && e.password === password && e.active === true);

    if (evaluator) {
      await this.signIntoFirebase();
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
    if (!this.dataMode.isLocal) {
      signOut(this.firebaseAuth).catch(() => {});
    }
    this.sessionSignal.set(null);
    this.isAuthenticated.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  private async signIntoFirebase(): Promise<void> {
    if (this.dataMode.isLocal) return;
    await signInAnonymously(this.firebaseAuth);
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
}
