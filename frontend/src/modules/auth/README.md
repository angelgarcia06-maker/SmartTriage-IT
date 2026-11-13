# Módulo auth (frontend)

Integrado en la aplicación React mediante `main.tsx` y `app/App.tsx`.

## Integración

- `main.tsx` envuelve la app con `BrowserRouter` y `AuthProvider`.
- `app/App.tsx` define las rutas:
  - `/login` → `LoginPage` (si ya hay sesión, redirige a `/`).
  - `/` → `RutaProtegida` + `Layout` → `InicioPage` (bienvenida autenticada con
    nombre y rol, estado de la API y tarjetas de módulos).
  - `/usuarios` → `RutaProtegida roles={['administrador']}` → `UsuariosPage`.
  - `*` → redirige a `/`.
- `Layout` muestra la identidad de la sesión, el enlace **Gestión de usuarios**
  solo para administradores y el botón **Cerrar sesión**.

## Componentes

| Archivo | Rol |
|---|---|
| `useAuth.tsx` | `AuthProvider` + `useAuth`: carga `/me` al iniciar, `login`, `logout`. |
| `authApi.ts` | Cliente HTTP real contra `/api/auth` (`credentials: 'include'`). |
| `LoginPage.tsx` | Formulario de inicio de sesión contra la API real. |
| `RutaProtegida.tsx` | Guard de UI (la protección real está en el backend). |
| `usuariosApi.ts` | Cliente HTTP de `/api/usuarios`. |
| `UsuariosPage.tsx` | Alta, edición, desactivación y listado de usuarios. |

La sesión se mantiene con la cookie `HttpOnly` del backend: al recargar, `useAuth`
vuelve a consultar `/api/auth/me` y conserva la sesión. No se usan datos simulados.

## Notas

- El login funciona contra la API real (`/api/auth/login`); no hay mocks.
- No se elimina ningún módulo de otros integrantes: las tarjetas de Tickets,
  Triaje y Administración siguen visibles en `InicioPage`.
- Si se abre el frontend desde `http://127.0.0.1:5173` (en lugar de `localhost`),
  el backend ya admite ese origen para la comprobación CSRF.
