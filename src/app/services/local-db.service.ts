import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  load<T>(key: string): T[] {
    const rawData = localStorage.getItem(this.key(key));
    if (!rawData) return [];

    try {
      return JSON.parse(rawData) as T[];
    } catch {
      return [];
    }
  }

  subject<T>(key: string): BehaviorSubject<T[]> {
    return new BehaviorSubject<T[]>(this.load<T>(key));
  }

  save<T>(key: string, subject: BehaviorSubject<T[]>, value: T[]): void {
    localStorage.setItem(this.key(key), JSON.stringify(value));
    subject.next(value);
  }

  private key(key: string): string {
    return `setu_${key}`;
  }
}
