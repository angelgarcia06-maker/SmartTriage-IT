
# Módulo Auth — Frontend

Módulo de autenticación y administración de usuarios del sistema SmartTriage IT.

Integrado en la aplicación React mediante `main.tsx` y `app/App.tsx`.

## 1. Integración

- `main.tsx` envuelve la aplicación con `BrowserRouter` y `AuthProvider`.
- `app/App.tsx` define las rutas:
  - `/login`: formulario de inicio de sesión.
  - `/`: página protegida con información del usuario autenticado.
  - `/usuarios`: administración de usuarios, exclusiva para administradores.
  - `*`: redirección a la ruta principal.

El componente Layout muestra la identidad del usuario, el enlace de gestión de usuarios para administradores y el botón de cierre de sesión.

## 2. Componentes principales

| Archivo | Responsabilidad |
|---|---|
| `useAuth.tsx` | Proveedor de autenticación y hook `useAuth`. |
| `authApi.ts` | Cliente HTTP para login, logout y consulta de sesión. |
| `csrf.ts` | Obtención, almacenamiento temporal e invalidación del token CSRF. |
| `LoginPage.tsx` | Formulario de inicio de sesión. |
| `RutaProtegida.tsx` | Protección de las rutas de la interfaz según autenticación y rol. |
| `usuariosApi.ts` | Cliente HTTP para administración de usuarios. |
| `UsuariosPage.tsx` | Listado, registro, edición y desactivación de usuarios. |

## 3. Comunicación con el backend

El frontend consume la API real del backend.

Las peticiones utilizan:

```ts
credentials: 'include'
```

Esto permite enviar la cookie de sesión al servidor.

No se almacenan contraseñas ni identificadores de sesión en localStorage. La sesión se mantiene mediante la cookie HttpOnly administrada por el backend.

Al iniciar la aplicación, `AuthProvider` consulta `/api/auth/me` para recuperar el usuario autenticado.

## 4. Protección CSRF en el frontend

El archivo `csrf.ts` administra el token CSRF asociado a la sesión.

Funcionamiento:

1. El frontend solicita `GET /api/auth/csrf`.
2. El backend devuelve un token asociado a la sesión.
3. El frontend conserva temporalmente el token en memoria.
4. Las operaciones que modifican datos incluyen el encabezado `X-CSRF-Token`.
5. Después de iniciar o cerrar sesión, se invalida el token almacenado para obtener uno nuevo cuando sea necesario.

El archivo `authApi.ts` incorpora automáticamente el encabezado CSRF en las peticiones que no utilizan métodos seguros.

Ejemplo:

```http
X-CSRF-Token: <token_obtenido_del_backend>
```

Las solicitudes utilizan `credentials: 'include'` para mantener la comunicación con la sesión del servidor.

## 5. Autenticación y autorización

El frontend implementa controles de navegación según el estado de autenticación y el rol.

Roles:
- Administrador.
- Agente.
- Técnico.

La interfaz puede ocultar o restringir opciones según el rol del usuario.

Sin embargo, la autorización real siempre se verifica en el backend mediante `loginRequired` y `roleRequired`. La protección visual no sustituye la seguridad del servidor.

## 6. Manejo de sesiones

- El inicio de sesión utiliza `/api/auth/login`.
- La consulta del usuario utiliza `/api/auth/me`.
- El cierre de sesión utiliza `/api/auth/logout`.
- La cookie de sesión es administrada por el backend.
- Al cerrar sesión se invalida el token CSRF almacenado.
- Cuando cambia la sesión, el frontend obtiene un nuevo token antes de realizar otra operación protegida.

La sesión tiene una duración configurada de 8 horas en el backend, con renovación mediante actividad.

## 7. Manejo de errores

El cliente HTTP comprueba las respuestas del backend.

- HTTP 401: usuario no autenticado o sesión no válida.
- HTTP 403: permisos insuficientes o token CSRF inválido.
- Otros errores: se muestra el mensaje devuelto por el servidor cuando está disponible.

Si la sesión expira, el usuario debe volver a autenticarse.

## 8. Pruebas y verificación

Desde la raíz del proyecto:

```powershell
npm run check
```

Esta verificación permite comprobar la compilación del frontend, la compilación del backend y las pruebas automatizadas configuradas en el proyecto.

## 9. Consideraciones de ejecución

El backend utiliza CORS con credenciales y actualmente configura como origen:

```text
http://localhost:5173
```

La comprobación CSRF contempla por defecto tanto `localhost` como `127.0.0.1` en desarrollo, pero esto no significa que ambos estén habilitados automáticamente en CORS.

Se recomienda utilizar `http://localhost:5173` para la ejecución habitual del frontend.

No se deben incluir archivos `.env`, secretos ni datos sensibles en el repositorio.
