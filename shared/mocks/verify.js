/**
 * Script de verificación para shared/mocks/mockUsers.js
 * Ejecutar: node shared/mocks/verify.js
 */
import { Roles, MOCK_USERS, DEFAULT_USERS, getUserById, getUsersByRole, getActiveUsers } from './index.js';

console.log('=== Roles ===');
console.log(Roles);
console.log();

console.log('=== MOCK_USERS ===');
MOCK_USERS.forEach(u => console.log(`  ${u.userId} | ${u.name} | ${u.role} | active=${u.isActive}`));
console.log();

console.log('=== DEFAULT_USERS ===');
console.log('  venueOwner:', DEFAULT_USERS.venueOwner.name);
console.log('  organizer:', DEFAULT_USERS.organizer.name);
console.log('  admin:', DEFAULT_USERS.admin.name);
console.log();

console.log('=== getUserById("user-002") ===');
console.log(getUserById('user-002'));
console.log();

console.log('=== getUsersByRole(Roles.VENUE_OWNER) ===');
console.log(getUsersByRole(Roles.VENUE_OWNER));
console.log();

console.log('=== getActiveUsers() ===');
console.log(getActiveUsers().map(u => u.name));
console.log();

// Validaciones
const hasVenueOwner = MOCK_USERS.some(u => u.role === Roles.VENUE_OWNER);
const hasOrganizer = MOCK_USERS.some(u => u.role === Roles.ORGANIZER);
const allHaveFields = MOCK_USERS.every(u => u.userId && u.name && u.email && u.role && typeof u.isActive === 'boolean');

if (hasVenueOwner && hasOrganizer && allHaveFields) {
  console.log('✅ Todas las validaciones pasaron correctamente');
} else {
  console.error('❌ Falló alguna validación');
  process.exit(1);
}
