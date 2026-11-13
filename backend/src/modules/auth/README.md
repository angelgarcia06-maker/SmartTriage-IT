# Auth — AUTH-01..04 (usuarios, sesión, roles y administración)

Módulo del Integrante 1. En esta rama está implementado y **montado en `app.ts`**:
AUTH-01 (base de usuarios), AUTH-02 (login/logout/sesión), AUTH-03 (roles) y
AUTH-04 (administración de usuarios).

## Integración en `backend/src/app.ts`

```ts
app.use(sessionMiddleware); // una sola instancia compartida por todos los módulos
app.use('/api/auth', csrfProtection, authRouterCompleto); // login/logout/me + usuarios
app.use('/api/usuarios', csrfProtection, usuariosRouter); // administración (solo admin)
app.use('/api', csrfProtection, crearRutasTriaje({ requiereRol: roleRequired }));
```

Se conservan `/api/health`, CORS (`origin: http://localhost:5173`, `credentials`)
y la configuración de Express. En producción se activa `app.set('trust proxy', 1)`
para que la cookie `secure: 'auto'` funcione tras un proxy inverso.
La sesión se monta una vez en la aplicación; los routers AUTH y Triaje no crean
instancias de sesión propias.

| Método y ruta | Acceso | Descripción |
|---|---|---|
| `POST /api/auth/login` | público | Autentica, regenera la sesión y fija la cookie. |
| `POST /api/auth/logout` | sesión | Destruye la sesión y limpia la cookie. |
| `GET /api/auth/me` | sesión | Usuario de la sesión (`UsuarioSesion`). |
| `GET /api/auth/usuarios/:id` | administrador | Usuario por id (sin `password_hash`). |
| `GET /api/auth/usuarios/por-usuario/:usuario` | administrador | Usuario por nombre. |
| `GET /api/usuarios` | administrador | Lista de usuarios. |
| `GET /api/usuarios/grupos` | administrador | Grupos activos. |
| `POST /api/usuarios` | administrador | Alta de usuario. |
| `PATCH /api/usuarios/:id` | administrador | Edición / desactivación (`activo:false`). |

No existe `DELETE`: los usuarios se desactivan. Un administrador no puede
desactivarse ni quitarse el rol, y siempre debe quedar al menos un administrador activo.

## Seguridad

- **Contraseñas**: hash bcrypt; `UsuarioPublico` nunca expone `password_hash`. La
  comparación usa un hash falso cuando el usuario no existe (evita filtrar por tiempo).
- **Sesión**: cookie `HttpOnly`, `SameSite=Lax`, `secure: 'auto'`, `maxAge` de 8 h.
  `saveUninitialized:false` y `resave:false`. Se **regenera** el id al autenticar
  (anti-fijación) y se **destruye** al cerrar sesión.
- **`SESSION_SECRET`**: obligatorio en producción (la app falla al arrancar si falta).
  En desarrollo se usa un secreto de prueba con aviso por consola. El `.env` no se sube.
- **CSRF** (`csrf.ts`): en métodos que modifican datos se verifica `Origin`/`Referer`
  contra el mismo host o una lista de confianza (`FRONTEND_ORIGIN`). Un navegador no
  puede falsificar esos encabezados. Se combina con `SameSite=Lax`.
- **Autorización**: `loginRequired` resuelve la identidad **desde el servidor**
  (`req.session.userId`) y `roleRequired(...roles)` aplica la política. Las rutas de
  administración exigen `administrador`; agentes y técnicos reciben `403`. El router
  de usuarios **falla cerrado** (401) si no se inyectan ambos middlewares.
- **Sin autenticación por encabezados**: no se confía en `x-usuario`, `authorization`,
  `creado_por`, etc. Hay pruebas que lo verifican.

## Contrato de identidad para otros módulos (Triaje, Tickets, Admin)

La **única fuente de identidad** es la sesión del servidor. Cualquier módulo debe
resolver el usuario con el helper canónico `usuarioDeRequest(req)` (o montar
`loginRequired`, que lo deja en `res.locals.usuario`):

```ts
import { loginRequired, roleRequired, usuarioDeRequest } from '../auth/auth.middleware';

router.post('/sugerir', roleRequired('agente', 'administrador'), (req, res) => {
  const usuario = res.locals.usuario; // UsuarioSesion { id, nombre, usuario, rol, grupo_id }
  // ...
});
```

- La sesión guarda **solo** `req.session.userId` (ver el `declare module` en
  `auth.types.ts`). No existe una segunda estructura de sesión.
- No leer la identidad de encabezados ni del cuerpo (`creado_por` recibido del cliente
  se ignora; se usa `res.locals.usuario.id`).
- El rol y el estado se releen de la base en cada petición, así que desactivar o
  cambiar el rol de un usuario surte efecto de inmediato.

### Integración con Triaje

Triaje usa `roleRequired('agente', 'administrador')` y el helper canónico
`usuarioDeRequest(req)` al registrar decisiones. Sus operaciones POST también
pasan por la protección CSRF compartida. La identidad se resuelve desde
`req.session.userId`; los roles y el estado del usuario se vuelven a consultar
en la base de datos en cada petición.

## Pruebas

```powershell
npm run test -w backend   # o: npm run check
```

Todas las pruebas corren contra una **base SQLite en memoria** con el seed aplicado
(`vitest.config.ts` + `src/test/setup.ts`, `DB_FILE=':memory:'`). **Ninguna ejecución
modifica `data/smarttriage.db`** ni los usuarios reales; cada archivo de prueba obtiene
su propia base. `auth.integration.test.ts` verifica rutas montadas, roles, CSRF y que la
base usada sea `:memory:`.

Cobertura:

- `auth.test.ts`: repositorio/servicio, DTO sin hash, 400/404, SQL parametrizado, fail-closed.
- `auth.session.test.ts`: login/logout, cookie `HttpOnly`/`SameSite`, regeneración, inactivos.
- `auth.roles.test.ts`: matriz de roles (401 sin sesión, 403 rol incorrecto).
- `usuarios.test.ts`: alta/edición/desactivación, duplicados, grupo de técnicos, guardas de admin.
- `auth.integration.test.ts`: `app.ts` real, `/api/health`, `/me`, gestión de usuarios y CSRF.

## Notas de tipos (TS6059)

El backend compila con `rootDir: "src"` y los contratos viven en `shared/types`, fuera de
esa carpeta. Importar `Rol` desde `shared/types/triaje.types.ts` produciría **TS6059**.
Se mantiene el alias `RolAuth` en `auth.types.ts`, con exactamente los mismos valores que
`Rol`. Cualquier cambio de roles debe replicarse aquí y en el `CHECK` de `usuarios.rol`.
