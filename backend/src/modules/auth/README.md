# Auth — AUTH-01 (base de usuarios)

Módulo del Integrante 1. En esta rama solo está implementado **AUTH-01**: lectura de usuarios y DTO público. El login/logout/sesión (AUTH-02) y los middlewares de autorización (AUTH-03) todavía no forman parte de este PR.

## Qué implementa AUTH-01

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Repositorio | `auth.repository.ts` | Consultas SQL **parametrizadas** a `usuarios` por `usuario` o `id`. Devuelve la fila interna (incluye `password_hash`). |
| Servicio | `auth.service.ts` | Convierte la fila en `UsuarioPublico`; **nunca** expone `password_hash`. |
| Controlador | `auth.controller.ts` | Valida el parámetro de entrada y responde 400/404/200. |
| Rutas | `auth.routes.ts` | Expone las consultas bajo middlewares inyectables y **fail-closed**. |

### Servicios

```ts
import { obtenerUsuarioPorId, obtenerUsuarioPorUsuario } from './auth.service';

obtenerUsuarioPorId(1);            // UsuarioPublico | null
obtenerUsuarioPorUsuario('admin'); // UsuarioPublico | null
```

`UsuarioPublico` contiene `id`, `nombre`, `usuario`, `rol`, `activo` y `grupo_id`. No contiene `password_hash`.

### Rutas

| Método y ruta | Implementación |
|---|---|
| `GET /api/auth/usuarios/:id` | Usuario por id; 400 si el id no es un entero positivo, 404 si no existe. |
| `GET /api/auth/usuarios/por-usuario/:usuario` | Usuario por nombre; 400 si el nombre está vacío, 404 si no existe. |

`authRouter` se exporta **sin** middlewares inyectados y, por diseño, responde `401` a todo: es un router fail-closed que no debe montarse tal cual. Para habilitar las rutas hay que usar la fábrica:

```ts
import { crearAuthRouter } from './modules/auth/auth.routes';

app.use('/api/auth', crearAuthRouter({
  requiereAutenticacion: loginRequired,          // AUTH-02
  requiereAutorizacion: roleRequired('administrador'), // AUTH-03
}));
```

Reglas de seguridad:

- Las rutas solo se habilitan cuando se inyectan **ambos** middlewares; si falta alguno, responden `401`. Así no pueden quedar públicas por olvido al integrar.
- No se implementó un login provisional ni autenticación por encabezados del cliente.
- **No montar `authRouter` en `backend/src/app.ts`** hasta que AUTH-02 y AUTH-03 estén listos. `app.ts` no se modifica en este PR.

## Qué falta para AUTH-02 y AUTH-03

- **AUTH-02:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, configuración de `express-session`, verificación de `password_hash` con bcrypt y `loginRequired`.
- **AUTH-03:** `roleRequired(...roles)` y la política de roles definitiva para estas consultas. El módulo de auth solo recibe el middleware ya configurado; no decide roles por su cuenta.

Hasta entonces, la aplicación no debe montar el router de usuarios.

## Tipos compartidos y TS6059

El backend compila con `rootDir: "src"` y los contratos viven en `shared/types`, fuera de esa carpeta. Importar `Rol` desde `shared/types/triaje.types.ts` incluye un archivo fuera de `rootDir` y produce **TS6059**. Cambiar `rootDir` a la raíz del repositorio alteraría el layout de `dist` que consume `npm start`.

Decisión temporal de AUTH-01: mantener `RolAuth` en `auth.types.ts`, con exactamente los mismos valores que `Rol` en `shared/types/triaje.types.ts`:

```ts
export type RolAuth = 'agente' | 'tecnico' | 'administrador';
```

Solución recomendada para el monorepositorio (fuera del alcance de este PR): publicar `shared/types` como paquete interno con declaraciones `.d.ts` emitidas, o configurar project references/`paths` con un `tsconfig` específico para `shared`. Mientras tanto, cualquier cambio en los roles compartidos debe replicarse aquí y en la validación de la base (`CHECK` de `usuarios.rol`).

## Pruebas

```powershell
npm run test -w backend
# o todas las verificaciones del repositorio
npm run check
```

`backend/src/modules/auth/auth.test.ts` cubre:

- búsqueda por nombre e id con datos reales;
- DTO y respuestas HTTP sin `password_hash`;
- 404/400 en búsquedas inexistentes o inválidas;
- rechazo `401` sin middlewares, incluso enviando encabezados de autenticación del cliente;
- rechazo `401` si falta el middleware de autorización (fail-closed);
- consultas SQL parametrizadas (marcadores `?` y valores enviados por separado).

Las pruebas de repositorio/API usan la base local `data/smarttriage.db` en modo **solo lectura**. Requieren que el seed exista:

```powershell
npm run db:init
npm run db:seed
```

No modifican datos ni eliminan la base local.
