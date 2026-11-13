
import {
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';

/* =====================================================
   1. GENERACIÓN DEL TOKEN CSRF DE SESIÓN
   ===================================================== */

export function obtenerTokenCsrf(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.session.csrfToken ?? randomBytes(32).toString('hex');

  req.session.csrfToken = token;

  res.setHeader('Cache-Control', 'no-store');

  req.session.save((err) => {
    if (err) return next(err);

    return res.json({ csrfToken: token });
  });
}

/* =====================================================
   2. VALIDACIÓN DEL TOKEN CSRF
   ===================================================== */

export function csrfTokenProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const metodo = req.method.toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(metodo)) {
    return next();
  }

  const esperado = req.session?.csrfToken;
  const recibido = req.get('X-CSRF-Token');

  if (
    !esperado ||
    !recibido ||
    !/^[a-f0-9]{64}$/.test(recibido)
  ) {
    return res.status(403).json({
      error: 'Token CSRF ausente o inválido',
    });
  }

  const esperadoBuffer = Buffer.from(esperado, 'utf8');
  const recibidoBuffer = Buffer.from(recibido, 'utf8');

  if (
    esperadoBuffer.length !== recibidoBuffer.length ||
    !timingSafeEqual(esperadoBuffer, recibidoBuffer)
  ) {
    return res.status(403).json({
      error: 'Token CSRF ausente o inválido',
    });
  }

  return next();
}

/* =====================================================
   3. VALIDACIÓN DEL ORIGEN DE LAS PETICIONES
   ===================================================== */

const METODOS_SEGUROS = new Set([
  'GET',
  'HEAD',
  'OPTIONS',
]);

function normalizarOrigen(valor: string): string | null {
  try {
    return new URL(valor).origin;
  } catch {
    return null;
  }
}

function origenesConfianza(): string[] {
  const desdeEntorno = process.env.FRONTEND_ORIGIN;

  const base = desdeEntorno
    ? desdeEntorno.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

  return base
    .map(normalizarOrigen)
    .filter((origen): origen is string => origen !== null);
}

/**
 * undefined: no se recibió Origin ni Referer.
 * null: se recibió un origen mal formado.
 * string: origen válido normalizado.
 */
function origenDeclarado(req: Request): string | null | undefined {
  const origin = req.get('origin');

  if (origin) {
    return normalizarOrigen(origin);
  }

  const referer = req.get('referer');

  if (referer) {
    return normalizarOrigen(referer);
  }

  return undefined;
}

/**
 * Protección de origen para las operaciones que modifican datos.
 * Se utiliza también de forma global en app.ts para las rutas de triaje.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (METODOS_SEGUROS.has(req.method.toUpperCase())) {
    return next();
  }

  const origen = origenDeclarado(req);

  // Los clientes no navegador pueden no enviar estos encabezados.
  if (origen === undefined) {
    return next();
  }

  // Si se recibió un origen inválido, se rechaza.
  if (origen === null) {
    res.status(403).json({ error: 'Origen no permitido' });
    return;
  }

  const host = req.get('host');

  let mismoHost = false;

  try {
    mismoHost = new URL(origen).host === host;
  } catch {
    mismoHost = false;
  }

  if (mismoHost || origenesConfianza().includes(origen)) {
    return next();
  }

  res.status(403).json({ error: 'Origen no permitido' });
}

/** Alias para mantener compatibilidad con la integración. */
export const requiereOrigenConfiable: RequestHandler = csrfProtection;
