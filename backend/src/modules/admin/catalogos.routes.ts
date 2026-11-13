
import { Router } from 'express';
import { db } from '../../db/connection';

export const catalogosRouter = Router();

// ADM-01: Obtener categorías activas
catalogosRouter.get('/categorias', (_req, res) => {
  try {
    const categorias = db.prepare(`
      SELECT
        c.id,
        c.nombre,
        c.grupo_id,
        g.nombre AS grupo_nombre
      FROM categorias c
      LEFT JOIN grupos g ON c.grupo_id = g.id
      WHERE c.activa = 1
        AND (c.grupo_id IS NULL OR g.activo = 1)
      ORDER BY c.nombre COLLATE NOCASE
    `).all();

    res.json(categorias);
  } catch (error) {
    console.error('Error al consultar categorías:', error);
    res.status(500).json({
      error: 'No se pudieron consultar las categorías'
    });
  }
});

// ADM-01: Obtener grupos activos
catalogosRouter.get('/grupos', (_req, res) => {
  try {
    const grupos = db.prepare(`
      SELECT id, nombre
      FROM grupos
      WHERE activo = 1
      ORDER BY nombre COLLATE NOCASE
    `).all();

    res.json(grupos);
  } catch (error) {
    console.error('Error al consultar grupos:', error);
    res.status(500).json({
      error: 'No se pudieron consultar los grupos'
    });
  }
});
