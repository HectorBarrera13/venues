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
    ├── index.ts         ← Barrel export (punto de entrada recomendado)
    ├── mockUsers.ts     ← Datos y helpers de usuarios mock
    ├── verify.ts        ← Script de verificación (npm run mocks:verify)
    └── README.md        ← Este archivo
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

Los módulos están escritos en TypeScript y usan sintaxis ESM (`export`), compatible
tanto con el backend (compilado por `tsc` a CommonJS) como con el frontend (Vite).
No es necesario añadir `"type": "module"` al `package.json`.

### Desde el Backend (Node.js / Express)

```ts
import { MOCK_USERS, Roles, DEFAULT_USERS, getUserById } from '../../shared/mocks';

// Uso en CurrentUserProvider
const currentUser = DEFAULT_USERS.venueOwner;
```

### Desde el Frontend (React / Vite)

```ts
import { MOCK_USERS, Roles, DEFAULT_USERS, getUsersByRole } from '../../shared/mocks';

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
- Los tipos `Role`, `MockUser` y `DefaultUsers` se exportan también para reutilizarlos
  en el tipado de frontend y backend.
- `DEFAULT_USERS` lanza un error si no existe un usuario activo para el rol buscado.
- Para agregar nuevos usuarios de prueba, edita **únicamente** `mockUsers.ts`.
- No dupliques estos datos en el frontend o backend; siempre importa desde aquí.
