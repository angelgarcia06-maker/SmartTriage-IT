import { Router } from 'express';
import {
  getUsuarioPorId,
  getUsuarioPorNombre,
  login,
  logout,
  me,
} from './auth.controller';
import { sessionMiddleware } from './session';

export const authRouter = Router();

// La sesión vive dentro del módulo, así no se toca app.ts.
authRouter.use(sessionMiddleware);

authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.get('/me', me);

// AUTH-01
authRouter.get('/usuarios/por-usuario/:usuario', getUsuarioPorNombre);
authRouter.get('/usuarios/:id', getUsuarioPorId);