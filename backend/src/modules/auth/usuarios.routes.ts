
import { Router } from 'express';
import { loginRequired, roleRequired } from './auth.middleware';
import {
  actualizar,
  crear,
  listar,
  listarGrupos,
} from './usuarios.controller';
import { csrfTokenProtection } from './csrf';

/**
 * Administración de usuarios (AUTH-04).
 * La sesión y la protección de origen se configuran globalmente en app.ts.
 * Solo los administradores pueden gestionar usuarios.
 */
export const usuariosRouter = Router();

usuariosRouter.use(loginRequired, roleRequired('administrador'));
usuariosRouter.use(csrfTokenProtection);

usuariosRouter.get('/grupos', listarGrupos);
usuariosRouter.get('/', listar);
usuariosRouter.post('/', crear);
usuariosRouter.patch('/:id', actualizar);
