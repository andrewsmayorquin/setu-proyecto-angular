import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/** Modelo de datos de un evaluador del sistema */
export interface Evaluator {
  id?: string;

  /** Nombre completo del evaluador */
  name: string;

  /** Correo electrónico del evaluador */
  email: string;

  /** Área de especialidad */
  specialty: string;

  /** Usuario para iniciar sesión */
  username: string;

  /** Contraseña para iniciar sesión */
  password: string;

  /** Rol del usuario */
  role: 'evaluador';

  /** Indica si el evaluador está activo */
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EvaluatorsService {

  private readonly storageKey = 'setu_evaluators';

  private readonly evaluatorsSubject = new BehaviorSubject<Evaluator[]>(
    this.loadEvaluators()
  );

  /** Busca un evaluador por su ID */
  getById(id: string): Evaluator | undefined {
    return this.evaluatorsSubject.value.find(
      evaluator => evaluator.id === id
    );
  }

  /** Lista de evaluadores */
  list(): Observable<Evaluator[]> {
    return this.evaluatorsSubject.asObservable();
  }

  /** Crear evaluador */
  async create(evaluator: Evaluator): Promise<void> {
    const evaluators = this.evaluatorsSubject.value;

    const usernameExists = evaluators.some(
      item =>
        item.username.toLowerCase() ===
        evaluator.username.toLowerCase()
    );

    if (usernameExists) {
      throw new Error('Ya existe un evaluador con ese usuario');
    }

    const emailExists = evaluators.some(
      item =>
        item.email.toLowerCase() ===
        evaluator.email.toLowerCase()
    );

    if (emailExists) {
      throw new Error('Ya existe un evaluador con ese correo electrónico');
    }

    const newEvaluator: Evaluator = {
      ...evaluator,
      id: crypto.randomUUID(),
      role: 'evaluador'
    };

    this.saveEvaluators([
      ...evaluators,
      newEvaluator
    ]);
  }

  /** Actualizar evaluador */
  async update(
    id: string,
    evaluator: Partial<Evaluator>
  ): Promise<void> {

    const evaluators = this.evaluatorsSubject.value;

    if (evaluator.username) {
      const usernameExists = evaluators.some(
        item =>
          item.id !== id &&
          item.username.toLowerCase() ===
          evaluator.username!.toLowerCase()
      );

      if (usernameExists) {
        throw new Error('Ya existe un evaluador con ese usuario');
      }
    }

    if (evaluator.email) {
      const emailExists = evaluators.some(
        item =>
          item.id !== id &&
          item.email.toLowerCase() ===
          evaluator.email!.toLowerCase()
      );

      if (emailExists) {
        throw new Error('Ya existe un evaluador con ese correo electrónico');
      }
    }

    const updatedEvaluators: Evaluator[] = evaluators.map(item =>
      item.id === id
        ? {
            ...item,
            ...evaluator,
            id,
            role: 'evaluador'
          }
        : item
    );

    this.saveEvaluators(updatedEvaluators);
  }

  /** Eliminar evaluador */
  async remove(id: string): Promise<void> {
    const updatedEvaluators = this.evaluatorsSubject.value.filter(
      evaluator => evaluator.id !== id
    );

    this.saveEvaluators(updatedEvaluators);
  }

  /** Cargar evaluadores desde localStorage */
  private loadEvaluators(): Evaluator[] {
    const data = localStorage.getItem(this.storageKey);

    if (!data) {
      return [];
    }

    try {
      const evaluators = JSON.parse(data) as any[];

      return evaluators.map(evaluator => ({
        id: evaluator.id,
        name: evaluator.name ?? '',
        email: evaluator.email ?? '',
        specialty: evaluator.specialty ?? '',
        username: evaluator.username ?? '',
        password: evaluator.password ?? '',
        role: 'evaluador' as const,
        active: evaluator.active ?? true
      }));
    } catch {
      return [];
    }
  }

  /** Guardar evaluadores en localStorage */
  private saveEvaluators(
    evaluators: Evaluator[]
  ): void {

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(evaluators)
    );

    this.evaluatorsSubject.next(evaluators);
  }
}