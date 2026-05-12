import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'setu-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isAuthenticatedSignal = signal(this.loadSession());
  readonly isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  login(username: string, password: string): boolean {
    const isValid = username === 'admin' && password === 'admin';
    this.isAuthenticatedSignal.set(isValid);
    if (isValid) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    return isValid;
  }

  logout(): void {
    this.isAuthenticatedSignal.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  private loadSession(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }
}
