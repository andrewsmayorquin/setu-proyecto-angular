import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/home/home').then(m => m.HomeComponent)
  },
  {
    path: 'ternas',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/ternas/ternas').then(m => m.TernasComponent)
  },
  {
    path: 'estudiantes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/estudiantes/estudiantes').then(m => m.EstudiantesComponent)
  },
  {
    path: 'evaluadores',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/evaluadores/evaluadores').then(m => m.EvaluadoresComponent)
  },
  {
    path: 'evaluacion',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/evaluacion/evaluacion').then(m => m.EvaluacionComponent)
  },
  {
    path: 'resultados',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/resultados/resultados').then(m => m.ResultadosComponent)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];