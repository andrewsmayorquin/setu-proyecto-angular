import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') || target?.isContentEditable;
    if (isTyping || !event.altKey) return;

    const shortcuts: Record<string, string> = {
      h: '/home',
      t: '/ternas',
      e: '/evaluacion',
      r: '/resultados',
      u: '/estudiantes',
      v: '/evaluadores'
    };

    const route = shortcuts[event.key.toLowerCase()];
    if (route) {
      event.preventDefault();
      this.router.navigate([route]);
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
