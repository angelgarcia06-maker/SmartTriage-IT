
# Auth — AUTH-01..06 (usuarios, autenticación, sesiones, roles y seguridad)

Módulo del Integrante 1. Implementa la autenticación, administración de usuarios, control de roles, seguridad de sesiones y pruebas de integración.

Alcance:
- AUTH-01: gestión y consulta de usuarios.
- AUTH-02: inicio y cierre de sesión.
- AUTH-03: autenticación y autorización basada en roles.
- AUTH-04: administración de usuarios.
- AUTH-05: seguridad de sesiones, protección CSRF y control de acceso.
- AUTH-06: pruebas, documentación y preparación de la integración mediante Pull Request.

## 1. Integración en backend/src/app.ts

El módulo utiliza una única instancia de sesión compartida:

```ts
app.use(sessionMiddleware);

app.use('/api/auth', csrfProtection, authRouterCompleto);
app.use('/api/usuarios', csrfProtection, usuariosRouter);
app.use('/api', csrfProtection, crearRutasTriaje({ requiereRol: roleRequired }));
```

La sesión se configura globalmente antes de montar los routers. Los módulos no deben crear instancias de sesión independientes.

En producción se habilita `trust proxy` para permitir que la cookie segura funcione detrás de un proxy inverso.

## 2. Endpoints de autenticación y usuarios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/auth/csrf` | Público | Obtiene el token CSRF asociado a la sesión. |
| POST | `/api/auth/login` | Público + CSRF | Autentica al usuario y regenera la sesión. |
| POST | `/api/auth/logout` | Sesión + CSRF | Destruye la sesión y cierra la autenticación. |
| GET | `/api/auth/me` | Sesión | Consulta el usuario autenticado. |
| GET | `/api/auth/usuarios/:id` | Administrador | Consulta un usuario por ID. |
| GET | `/api/auth/usuarios/por-usuario/:usuario` | Administrador | Consulta un usuario por nombre. |
| GET | `/api/usuarios` | Administrador | Lista los usuarios. |
| GET | `/api/usuarios/grupos` | Administrador | Lista los grupos activos. |
| POST | `/api/usuarios` | Administrador + CSRF | Registra un usuario. |
| PATCH | `/api/usuarios/:id` | Administrador + CSRF | Actualiza o desactiva un usuario. |

No se utiliza DELETE para eliminar usuarios. La baja se realiza mediante desactivación (`activo: false`).

Un administrador no puede desactivarse ni quitarse su propio rol. Siempre debe existir al menos un administrador activo.

## 3. Seguridad de autenticación y sesiones

### Contraseñas
- Se utiliza bcrypt para almacenar contraseñas mediante hashes.
- Las respuestas públicas nunca incluyen `password_hash`.
- Se utiliza un hash ficticio cuando el usuario no existe para reducir diferencias de tiempo en la autenticación.

### Sesiones
- Cookie: `smarttriage.sid`.
- Duración: 8 horas.
- `HttpOnly: true`.
- `SameSite: Lax`.
- `secure: 'auto'`.
- `rolling: true` para renovar la expiración durante la actividad.
- `saveUninitialized: false`.
- `resave: false`.
- Regeneración del identificador de sesión al iniciar sesión.
- Destrucción de la sesión al cerrar sesión.

La identidad se almacena en el servidor mediante `req.session.userId`.

El usuario y su rol se vuelven a consultar en la base de datos en cada petición protegida. Así, los cambios de rol y las desactivaciones tienen efecto inmediato.

### SESSION_SECRET
- Es obligatorio en producción.
- Debe contener al menos 32 caracteres.
- En desarrollo y pruebas se utiliza una clave temporal aleatoria cuando no está configurado.
- Nunca se deben subir archivos `.env` ni secretos reales al repositorio.

## 4. Protección CSRF

La protección utiliza dos mecanismos complementarios.

### Token CSRF
El endpoint `GET /api/auth/csrf` genera o recupera un token de 32 bytes asociado a la sesión.

Las operaciones protegidas envían el encabezado:

```http
X-CSRF-Token: <token>
```

El backend:
- Comprueba que exista un token de sesión.
- Comprueba que el encabezado esté presente y tenga el formato esperado.
- Compara ambos tokens utilizando `timingSafeEqual`.
- Rechaza las solicitudes inválidas con HTTP 403.

El token se utiliza en las operaciones de autenticación y en las operaciones de escritura de administración de usuarios.

### Validación de origen
El middleware `csrfProtection` comprueba los encabezados `Origin` y `Referer` en las operaciones que modifican datos.

Se permiten:
- El mismo origen del servidor.
- Los orígenes configurados mediante `FRONTEND_ORIGIN`.
- Los orígenes predeterminados de desarrollo cuando no existe una configuración personalizada.

Los orígenes inválidos o no autorizados reciben HTTP 403.

Los métodos GET, HEAD y OPTIONS no requieren esta comprobación de origen.

## 5. Autorización y roles

Los roles disponibles son:
- `administrador`
- `agente`
- `tecnico`

Middlewares principales:

```ts
import {
  loginRequired,
  roleRequired,
  usuarioDeRequest,
} from '../auth/auth.middleware';
```

Ejemplo de autorización:

```ts
router.post(
  '/sugerir',
  roleRequired('agente', 'administrador'),
  (req, res) => {
    const usuario = res.locals.usuario;
    // Procesamiento de la solicitud.
  }
);
```

Reglas:
- `loginRequired` exige una sesión válida.
- `roleRequired(...roles)` verifica los permisos.
- `usuarioDeRequest(req)` obtiene la identidad desde la sesión del servidor.
- HTTP 401 indica que el usuario no está autenticado.
- HTTP 403 indica que no tiene permisos suficientes.

No se confía en encabezados ni datos enviados por el cliente para determinar la identidad del usuario.

## 6. Contrato de identidad para otros módulos

Los módulos Triaje, Tickets y Admin deben utilizar el middleware compartido de autenticación.

La identidad debe obtenerse desde `req.session.userId` mediante `usuarioDeRequest(req)` o `loginRequired`.

No se debe crear una segunda sesión ni confiar en campos como `x-usuario` o `creado_por` enviados desde el frontend.

La integración de cada módulo debe coordinarse con su responsable y con el Integrante 5 cuando implique cambios en archivos compartidos o rutas globales.

Actualmente, Triaje se encuentra montado en `app.ts`. Tickets y Admin mantienen sus propias responsabilidades de implementación.

## 7. Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de ejecución del backend. |
| `DB_FILE` | Ruta opcional de la base SQLite. |
| `SESSION_SECRET` | Secreto de firma de sesiones, mínimo 32 caracteres. |
| `FRONTEND_ORIGIN` | Lista de orígenes permitidos para la validación CSRF, separados por comas. |

Ejemplo de configuración:

```env
PORT=3000
SESSION_SECRET=<secreto_aleatorio_propio>
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

El archivo `.env.example` contiene únicamente valores de referencia. No se deben publicar secretos reales.

Nota: la lista de orígenes CSRF no sustituye la configuración CORS. Actualmente `app.ts` configura CORS para `http://localhost:5173`.

## 8. Pruebas y verificación

Para ejecutar las pruebas:

```powershell
npm run test -w backend
```

Para ejecutar las verificaciones completas:

```powershell
npm run check
```

La suite utiliza una base SQLite en memoria para evitar modificar la base de datos local.

Cobertura principal:

- `auth.test.ts`: repositorio, servicio, DTO, validaciones y consultas seguras.
- `auth.session.test.ts`: login, logout, cookies, sesiones, CSRF y usuarios inactivos.
- `auth.roles.test.ts`: autenticación y matriz de permisos.
- `usuarios.test.ts`: registro, edición, desactivación y validación de usuarios.
- `auth.integration.test.ts`: aplicación real, integración de rutas, roles, CSRF y contratos de identidad.
- Pruebas de Triaje: integración con autenticación, sesiones y validaciones.

La última ejecución completa registrada durante el desarrollo obtuvo 132 pruebas aprobadas. Se debe volver a ejecutar `npm run check` después de cualquier modificación.

## 9. Consideraciones para la entrega

- Mantener el desarrollo en `feature/auth-usuarios`.
- No realizar commits directamente en `main`.
- No modificar módulos de otros integrantes sin coordinación.
- Mantener actualizada la documentación de endpoints, permisos y variables.
- Vincular el trabajo con los issues AUTH-05 y AUTH-06 en el Pull Request.
- Adjuntar el resultado de las verificaciones realizadas.
