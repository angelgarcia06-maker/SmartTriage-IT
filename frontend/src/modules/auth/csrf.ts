
let tokenCache: string | null = null;
let solicitudPendiente: Promise<string> | null = null;

/**
 * Obtiene el token CSRF asociado a la sesión del navegador.
 * Evita realizar solicitudes duplicadas mientras se obtiene.
 */
export async function obtenerTokenCsrf(): Promise<string> {
  if (tokenCache) return tokenCache;

  if (!solicitudPendiente) {
    solicitudPendiente = (async () => {
      const respuesta = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const datos = (await respuesta.json().catch(() => null)) as
        | { csrfToken?: unknown }
        | null;

      if (!respuesta.ok || typeof datos?.csrfToken !== 'string') {
        throw new Error('No se pudo obtener el token de seguridad CSRF');
      }

      tokenCache = datos.csrfToken;
      return tokenCache;
    })().finally(() => {
      solicitudPendiente = null;
    });
  }

  return solicitudPendiente;
}

/**
 * Invalida el token almacenado después de cambiar la sesión.
 */
export function invalidarTokenCsrf(): void {
  tokenCache = null;
}
