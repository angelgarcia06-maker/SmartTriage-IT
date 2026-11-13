
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Genera un token CSRF asociado a la sesión actual.
 * La sesión se guarda antes de devolver el token al frontend.
 */
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

/**
 * Protege las operaciones que modifican información.
 * GET, HEAD y OPTIONS no requieren token CSRF.
 */
export function csrfProtection(
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
