# 📁 shared/mocks — Mock User + Role Test Data

> **Tarea 19** · Venues Module · Sistema tipo Ticketmaster

---

## 📋 Descripción

Esta carpeta contiene los **datos simulados de usuarios y roles** que se utilizan
durante el desarrollo y las pruebas del módulo de recintos (Venues). Actúa como
la **única fuente de verdad** para los datos de autenticación mock en todo el
monorepo.

## 🗂️ Estructura

```
shared/
└── mocks/
    ├── index.js        ← Barrel export (punto de entrada recomendado)
    ├── mockUsers.js    ← Datos y helpers de usuarios mock
    └── README.md       ← Este archivo
```

## 👥 Usuarios disponibles

| userId     | Nombre           | Email                          | Rol           | Activo |
|------------|------------------|--------------------------------|---------------|--------|
| `user-001` | Carlos Méndez    | carlos.mendez@venues.test      | `venue_owner` | ✅      |
| `user-002` | Ana García       | ana.garcia@venues.test         | `organizer`   | ✅      |
| `user-003` | Luis Rodríguez   | luis.rodriguez@venues.test     | `admin`       | ✅      |
| `user-004` | María López      | maria.lopez@venues.test        | `venue_owner` | ❌      |

## 🔑 Roles definidos

```js
import { Roles } from '../../shared/mocks';

Roles.VENUE_OWNER  // → 'venue_owner'
Roles.ORGANIZER    // → 'organizer'
Roles.ADMIN        // → 'admin'
```

## 📦 Cómo importar

### Desde el Backend (Node.js / Express)

```js
// Ruta relativa desde backend/src/
import { MOCK_USERS, Roles, DEFAULT_USERS, getUserById } from '../../shared/mocks/index.js';

// Uso en CurrentUserProvider
const currentUser = DEFAULT_USERS.venueOwner;
```

### Desde el Frontend (React / Vite)

```js
// Ruta relativa desde frontend/src/
import { MOCK_USERS, Roles, DEFAULT_USERS, getUsersByRole } from '../../shared/mocks/index.js';

// Uso en CurrentUserService
const organizers = getUsersByRole(Roles.ORGANIZER);
```

## 🛠️ API disponible

| Export            | Tipo       | Descripción                                                  |
|-------------------|-----------|--------------------------------------------------------------|
| `Roles`           | `Object`  | Enum con las constantes de roles: `VENUE_OWNER`, `ORGANIZER`, `ADMIN` |
| `MOCK_USERS`      | `Array`   | Lista completa de usuarios mock (frozen)                     |
| `DEFAULT_USERS`   | `Object`  | Atajos: `.venueOwner`, `.organizer`, `.admin`                |
| `getUserById(id)` | `Function`| Busca un usuario por `userId`                                |
| `getUsersByRole(role)` | `Function` | Filtra usuarios por rol                                |
| `getActiveUsers()`| `Function`| Devuelve solo los usuarios activos                           |

## ⚠️ Notas importantes

- Los datos están **congelados** (`Object.freeze`) para prevenir mutaciones accidentales.
- Este módulo usa **ES Module syntax** (`export`). El backend debe tener
  `"type": "module"` en su `package.json` o usar la extensión `.mjs`.
- Para agregar nuevos usuarios de prueba, edita **únicamente** `mockUsers.js`.
- No dupliques estos datos en el frontend o backend; siempre importa desde aquí.
