import { Router } from 'express';
import { getUsuarioPorId, getUsuarioPorNombre } from './auth.controller';

export const authRouter = Router();

authRouter.get('/usuarios/por-usuario/:usuario', getUsuarioPorNombre);
authRouter.get('/usuarios/:id', getUsuarioPorId);