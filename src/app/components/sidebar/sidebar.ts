import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive]
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly session = this.auth.session;

  readonly isAdmin = computed(
    () => this.auth.getRole() === 'admin'
  );

  readonly isEvaluator = computed(
    () => this.auth.getRole() === 'evaluador'
  );

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}