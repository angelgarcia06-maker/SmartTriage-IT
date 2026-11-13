import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Protección CSRF para peticiones que modifican datos.
 *
 * Estrategia (defensa en capas):
 *  1. La cookie de sesión es `SameSite=Lax` (ver `session.ts`), por lo que un
 *     navegador NO adjunta la sesión en POST/PATCH cross-site.
 *  2. Este middleware verifica el origen real de la petición (`Origin`, o
 *     `Referer` como respaldo). Un navegador no puede falsificar estos
 *     encabezados, así que una página atacante no puede superar la comprobación.
 *
 * Si la petición no trae `Origin`/`Referer` se trata como cliente no-navegador
 * (curl, pruebas, integraciones) y se permite: la CSRF solo existe cuando el
 * navegador adjunta cookies automáticamente, y en ese caso siempre envía
 * `Origin` en métodos que modifican estado.
 *
 * No se confía en ningún encabezado de identidad del cliente; esto solo valida
 * el origen, nunca la autenticación.
 */

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Orígenes de confianza configurables; por defecto el frontend de desarrollo. */
function origenesConfianza(): string[] {
  const desdeEntorno = process.env.FRONTEND_ORIGIN;
  const base = desdeEntorno
    ? desdeEntorno.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return base.map((o) => {
    try {
      return new URL(o).origin;
    } catch {
      return o;
    }
  });
}

/** Devuelve el origen declarado por la petición, o null si no viene ninguno. */
function origenDeclarado(req: Request): string | null {
  const origin = req.get('origin');
  if (origin) return origin;
  const referer = req.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method)) return next();

  const origen = origenDeclarado(req);
  if (origen === null) return next(); // Cliente no-navegador: sin riesgo de CSRF.

  // Mismo host que la API (uso directo o proxy inverso).
  const host = req.get('host');
  let mismoHost = false;
  try {
    mismoHost = new URL(origen).host === host;
  } catch {
    mismoHost = false;
  }

  if (mismoHost || origenesConfianza().includes(origen)) return next();

  res.status(403).json({ error: 'Origen no permitido' });
}

/** Handler reutilizable para montar en routers concretos. */
export const requiereOrigenConfiable: RequestHandler = csrfProtection;
