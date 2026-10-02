/**
 * Tarea 19 – Mock User + Role Test Data
 *
 * Datos simulados de usuarios con roles para el módulo de recintos (Venues).
 * Este archivo es la **única fuente de verdad** para los usuarios de prueba
 * y está diseñado para ser consumido tanto por el backend (CurrentUserProvider)
 * como por el frontend (CurrentUserService).
 *
 * ──────────────────────────────────────────────
 *  Cómo importar
 * ──────────────────────────────────────────────
 *
 *  Desde el backend  (CommonJS, compilado con `tsc`):
 *    import { MOCK_USERS, getUserById, getUsersByRole, Roles } from '../../shared/mocks';
 *
 *  Desde el frontend (ES Modules / Vite):
 *    import { MOCK_USERS, getUserById, getUsersByRole, Roles } from '../../shared/mocks';
 *
 * ──────────────────────────────────────────────
 *  Roles disponibles
 * ──────────────────────────────────────────────
 *  - venue_owner : propietario de un recinto
 *  - organizer   : organizador de eventos
 *  - admin       : administrador del sistema
 *
 * ──────────────────────────────────────────────
 */

// ─── Estructura de un MockUser ──────────────────────────────────────────────

/**
 * Enum-like con los roles válidos del sistema.
 * Usar estas constantes evita errores por typos al comparar strings.
 */
export const Roles = Object.freeze({
  VENUE_OWNER: 'venue_owner',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
} as const);

export type Role = (typeof Roles)[keyof typeof Roles];

export interface MockUser {
  /** Identificador único del usuario. */
  userId: string;
  /** Nombre completo del usuario. */
  name: string;
  /** Correo electrónico del usuario. */
  email: string;
  /** Rol asignado (ver {@link Roles}). */
  role: Role;
  /** Indica si la cuenta está activa. */
  isActive: boolean;
}

// ─── Datos de prueba ────────────────────────────────────────────────────────

/**
 * Lista de usuarios mock para pruebas y desarrollo.
 * Incluye al menos un `venue_owner` y un `organizer` como lo requiere la Tarea 19.
 */
export const MOCK_USERS: readonly MockUser[] = Object.freeze([
  {
    userId: 'user-001',
    name: 'Carlos Méndez',
    email: 'carlos.mendez@venues.test',
    role: Roles.VENUE_OWNER,
    isActive: true,
  },
  {
    userId: 'user-002',
    name: 'Ana García',
    email: 'ana.garcia@venues.test',
    role: Roles.ORGANIZER,
    isActive: true,
  },
  {
    userId: 'user-003',
    name: 'Luis Rodríguez',
    email: 'luis.rodriguez@venues.test',
    role: Roles.ADMIN,
    isActive: true,
  },
  {
    userId: 'user-004',
    name: 'María López',
    email: 'maria.lopez@venues.test',
    role: Roles.VENUE_OWNER,
    isActive: false,
  },
]);

// ─── Funciones auxiliares (helpers) ─────────────────────────────────────────

/**
 * Busca un usuario mock por su `userId`.
 *
 * @example
 * const owner = getUserById('user-001');
 * // → { userId: 'user-001', name: 'Carlos Méndez', … }
 */
export function getUserById(id: string): MockUser | undefined {
  return MOCK_USERS.find((user) => user.userId === id);
}

/**
 * Devuelve todos los usuarios mock que poseen un rol determinado.
 *
 * @example
 * const organizers = getUsersByRole(Roles.ORGANIZER);
 * // → [{ userId: 'user-002', name: 'Ana García', … }]
 */
export function getUsersByRole(role: Role): MockUser[] {
  return MOCK_USERS.filter((user) => user.role === role);
}

/**
 * Devuelve únicamente los usuarios mock activos.
 */
export function getActiveUsers(): MockUser[] {
  return MOCK_USERS.filter((user) => user.isActive);
}

function getActiveUserByRole(role: Role): MockUser {
  const user = getActiveUsers().find((candidate) => candidate.role === role);
  if (!user) {
    throw new Error(`No active mock user found for role "${role}"`);
  }
  return user;
}

export interface DefaultUsers {
  venueOwner: MockUser;
  organizer: MockUser;
  admin: MockUser;
}

/**
 * Atajos de acceso rápido a usuarios representativos.
 * Útil para configurar rápidamente un "usuario actual" en proveedores de contexto.
 */
export const DEFAULT_USERS: Readonly<DefaultUsers> = Object.freeze({
  venueOwner: getActiveUserByRole(Roles.VENUE_OWNER),
  organizer: getActiveUserByRole(Roles.ORGANIZER),
  admin: getActiveUserByRole(Roles.ADMIN),
});