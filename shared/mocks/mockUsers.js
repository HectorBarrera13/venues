/**
 * @module mockUsers
 * @description
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
 *  Desde el backend  (CommonJS):
 *    const { MOCK_USERS, getUserById, getUsersByRole, Roles } = require('../../shared/mocks/mockUsers');
 *
 *  Desde el frontend (ES Modules / Vite):
 *    import { MOCK_USERS, getUserById, getUsersByRole, Roles } from '../../shared/mocks/mockUsers';
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

// ─── Constantes de roles ────────────────────────────────────────────────────

/**
 * Enum-like con los roles válidos del sistema.
 * Usar estas constantes evita errores por typos al comparar strings.
 *
 * @readonly
 * @enum {string}
 */
const Roles = Object.freeze({
  VENUE_OWNER: 'venue_owner',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
});

// ─── Estructura de un MockUser ──────────────────────────────────────────────

/**
 * @typedef  {Object}  MockUser
 * @property {string}  userId   - Identificador único del usuario.
 * @property {string}  name     - Nombre completo del usuario.
 * @property {string}  email    - Correo electrónico del usuario.
 * @property {string}  role     - Rol asignado (ver {@link Roles}).
 * @property {boolean} isActive - Indica si la cuenta está activa.
 */

// ─── Datos de prueba ────────────────────────────────────────────────────────

/**
 * Lista de usuarios mock para pruebas y desarrollo.
 * Incluye al menos un `venue_owner` y un `organizer` como lo requiere la Tarea 19.
 *
 * @type {MockUser[]}
 */
const MOCK_USERS = Object.freeze([
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
 * @param   {string}          id - El identificador del usuario.
 * @returns {MockUser|undefined}  El usuario encontrado o `undefined`.
 *
 * @example
 * const owner = getUserById('user-001');
 * // → { userId: 'user-001', name: 'Carlos Méndez', … }
 */
function getUserById(id) {
  return MOCK_USERS.find((user) => user.userId === id);
}

/**
 * Devuelve todos los usuarios mock que poseen un rol determinado.
 *
 * @param   {string}     role - El rol a filtrar (usar constantes de {@link Roles}).
 * @returns {MockUser[]}        Array de usuarios que coinciden con el rol.
 *
 * @example
 * const organizers = getUsersByRole(Roles.ORGANIZER);
 * // → [{ userId: 'user-002', name: 'Ana García', … }]
 */
function getUsersByRole(role) {
  return MOCK_USERS.filter((user) => user.role === role);
}

/**
 * Devuelve únicamente los usuarios mock activos.
 *
 * @returns {MockUser[]} Array de usuarios con `isActive === true`.
 */
function getActiveUsers() {
  return MOCK_USERS.filter((user) => user.isActive);
}

/**
 * Atajos de acceso rápido a usuarios representativos.
 * Útil para configurar rápidamente un "usuario actual" en proveedores de contexto.
 *
 * @type {{ venueOwner: MockUser, organizer: MockUser, admin: MockUser }}
 */
const DEFAULT_USERS = Object.freeze({
  venueOwner: MOCK_USERS.find((u) => u.role === Roles.VENUE_OWNER && u.isActive),
  organizer: MOCK_USERS.find((u) => u.role === Roles.ORGANIZER && u.isActive),
  admin: MOCK_USERS.find((u) => u.role === Roles.ADMIN && u.isActive),
});

// ─── Exportación dual (CommonJS + ESM) ──────────────────────────────────────
// Se usa un patrón compatible con ambos sistemas de módulos para que
// tanto el backend (require) como el frontend (import) puedan consumirlo.

export { Roles, MOCK_USERS, DEFAULT_USERS, getUserById, getUsersByRole, getActiveUsers };
