/**
 * Barrel export para todos los datos mock del proyecto Venues.
 * Importar desde aquí simplifica las rutas de acceso.
 *
 * @example
 * // Backend (CommonJS compilado por tsc)
 * const { MOCK_USERS, Roles, DEFAULT_USERS } = require('../../shared/mocks');
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

export type { Role, MockUser, DefaultUsers } from './mockUsers';