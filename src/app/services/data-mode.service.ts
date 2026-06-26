import { Injectable } from '@angular/core';

export type DataMode = 'firebase' | 'local';

/**
 * Controla si la app guarda datos en Firebase o en localStorage.
 *
 * Por defecto usa Firebase. Para pruebas locales abre la consola del navegador y ejecuta:
 * localStorage.setItem('setu_data_mode', 'local'); location.reload();
 *
 * Para volver a Firebase:
 * localStorage.setItem('setu_data_mode', 'firebase'); location.reload();
 */
@Injectable({ providedIn: 'root' })
export class DataModeService {
  private readonly storageKey = 'setu_data_mode';

  get mode(): DataMode {
    return localStorage.getItem(this.storageKey) === 'local' ? 'local' : 'firebase';
  }

  get isLocal(): boolean {
    return this.mode === 'local';
  }

  setLocalMode(): void {
    localStorage.setItem(this.storageKey, 'local');
  }

  setFirebaseMode(): void {
    localStorage.setItem(this.storageKey, 'firebase');
  }
}
