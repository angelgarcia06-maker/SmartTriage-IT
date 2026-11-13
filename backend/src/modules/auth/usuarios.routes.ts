import { csrfProtection } from './csrf';
import { Router } from 'express';
import { loginRequired, roleRequired } from './auth.middleware';
import { actualizar, crear, listar, listarGrupos } from './usuarios.controller';
import { sessionMiddleware } from './session';

/**
 * Administración de usuarios (AUTH-04). Solo administrador.
 * Montar en app.ts: app.use('/api/usuarios', usuariosRouter)
 * No existe DELETE: se desactiva con PATCH { activo: false }.
 */
export const usuariosRouter = Router();

usuariosRouter.use(sessionMiddleware);
usuariosRouter.use(loginRequired, roleRequired('administrador'));
usuariosRouter.use(csrfProtection);

usuariosRouter.get('/grupos', listarGrupos); // antes de /:id
usuariosRouter.get('/', listar);
usuariosRouter.post('/', crear);
usuariosRouter.patch('/:id', actualizar);