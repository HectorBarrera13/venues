/**
 * @module shared/mocks
 * @description
 * Barrel export para todos los datos mock del proyecto Venues.
 * Importar desde aquí simplifica las rutas de acceso.
 *
 * @example
 * // Backend (TypeScript)
 * import { MOCK_USERS, Roles, DEFAULT_USERS } from '../../shared/mocks';
 *
 * // Frontend (ESM / Vite)
 * import { MOCK_USERS, Roles, DEFAULT_USERS } from '../../shared/mocks';
 */

export {
  Roles,
  MOCK_USERS,
  DEFAULT_USERS,
  getUserById,
  getUsersByRole,
  getActiveUsers,
} from './mockUsers';
export type { MockUser } from './mockUsers';
