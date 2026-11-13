
import { Router, type RequestHandler } from 'express';
import { db } from '../../db/connection';
import { normalizarTexto } from '../triaje/normalizar';
import { clasificar } from '../triaje/clasificador';

interface SeguridadDiccionario {
  requiereAutenticacion?: RequestHandler;
  requiereAdministrador?: RequestHandler;
}

const denegarAcceso: RequestHandler = (_req, res) => {
  res.status(401).json({
    error: 'Autenticación administrativa no configurada'
  });
};

export function crearDiccionarioRouter(
  seguridad: SeguridadDiccionario = {}
): Router {
  const router = Router();

  const proteger: RequestHandler[] =
    seguridad.requiereAutenticacion &&
    seguridad.requiereAdministrador
      ? [
          seguridad.requiereAutenticacion,
          seguridad.requiereAdministrador
        ]
      : [denegarAcceso];

  // ADM-03: Consultar palabras clave
  router.get('/palabras-clave', ...proteger, (_req, res) => {
    try {
      const palabras = db.prepare(`
        SELECT
          p.id,
          p.palabra,
          p.categoria_id,
          c.nombre AS categoria
        FROM palabras_clave p
        INNER JOIN categorias c
          ON c.id = p.categoria_id
        WHERE c.activa = 1
        ORDER BY c.nombre, p.palabra
      `).all();

      res.json(palabras);
    } catch (error) {
      console.error('Error al consultar palabras:', error);
      res.status(500).json({
        error: 'No se pudo consultar el diccionario'
      });
    }
  });

  // ADM-03: Registrar palabra clave
  router.post('/palabras-clave', ...proteger, (req, res) => {
    const palabra = req.body?.palabra;
    const categoriaId = req.body?.categoria_id;

    if (
      typeof palabra !== 'string' ||
      !palabra.trim() ||
      palabra.trim().length > 80 ||
      !normalizarTexto(palabra) ||
      !Number.isSafeInteger(categoriaId) ||
      categoriaId <= 0
    ) {
      res.status(400).json({
        error: 'Palabra o categoría inválida'
      });
      return;
    }

    try {
      const categoria = db.prepare(`
        SELECT id, nombre
        FROM categorias
        WHERE id = ? AND activa = 1
      `).get(categoriaId) as {
        id: number;
        nombre: string;
      } | undefined;

      if (!categoria || categoria.nombre === 'Otros') {
        res.status(400).json({
          error: 'Selecciona una categoría válida y activa'
        });
        return;
      }

      const normalizada = normalizarTexto(palabra);

      const guardar = db.transaction(() => {
        const existentes = db.prepare(`
          SELECT palabra FROM palabras_clave
          WHERE categoria_id = ?
        `).all(categoriaId) as { palabra: string }[];

        const duplicada = existentes.some(
          item => normalizarTexto(item.palabra) === normalizada
        );

        if (duplicada) return null;

        const resultado = db.prepare(`
          INSERT INTO palabras_clave (categoria_id, palabra)
          VALUES (?, ?)
        `).run(categoriaId, palabra.trim());

        return Number(resultado.lastInsertRowid);
      });

      const id = guardar();

      if (id === null) {
        res.status(409).json({
          error: 'La palabra clave ya existe en esta categoría'
        });
        return;
      }

      res.status(201).json({
        id,
        palabra: palabra.trim(),
        categoria_id: categoriaId,
        categoria: categoria.nombre
      });
    } catch (error) {
      console.error('Error al guardar palabra:', error);
      res.status(500).json({
        error: 'No se pudo registrar la palabra clave'
      });
    }
  });

  // ADM-03: Probar frase usando el clasificador existente
  router.post('/probar-frase', ...proteger, (req, res) => {
    const frase = req.body?.frase;

    if (
      typeof frase !== 'string' ||
      !normalizarTexto(frase) ||
      frase.length > 5000
    ) {
      res.status(400).json({
        error: 'Ingresa una frase válida'
      });
      return;
    }

    try {
      const resultado = clasificar(frase, db);

      res.json({
        frase,
        ...resultado
      });
    } catch (error) {
      console.error('Error al clasificar frase:', error);
      res.status(500).json({
        error: 'No se pudo clasificar la frase'
      });
    }
  });

  // ADM-03: Editar palabra clave
  router.patch('/palabras-clave/:id', ...proteger, (req, res) => {
    const parametro = req.params.id;
    const id = typeof parametro === 'string'
      ? Number(parametro)
      : NaN;

    const palabra = req.body?.palabra;
    const categoriaId = req.body?.categoria_id;

    if (
      typeof parametro !== 'string' ||
      !/^[1-9]\d*$/.test(parametro) ||
      !Number.isSafeInteger(id) ||
      typeof palabra !== 'string' ||
      !palabra.trim() ||
      palabra.trim().length > 80 ||
      !normalizarTexto(palabra) ||
      !Number.isSafeInteger(categoriaId) ||
      categoriaId <= 0
    ) {
      res.status(400).json({
        error: 'ID, palabra o categoría inválidos'
      });
      return;
    }

    try {
      const existente = db.prepare(`
        SELECT id
        FROM palabras_clave
        WHERE id = ?
      `).get(id);

      if (!existente) {
        res.status(404).json({
          error: 'Palabra clave no encontrada'
        });
        return;
      }

      const categoria = db.prepare(`
        SELECT id, nombre
        FROM categorias
        WHERE id = ? AND activa = 1
      `).get(categoriaId) as {
        id: number;
        nombre: string;
      } | undefined;

      if (!categoria || categoria.nombre === 'Otros') {
        res.status(400).json({
          error: 'Selecciona una categoría válida y activa'
        });
        return;
      }

      const normalizada = normalizarTexto(palabra);

      const actualizar = db.transaction(() => {
        const existentes = db.prepare(`
          SELECT id, palabra
          FROM palabras_clave
          WHERE categoria_id = ? AND id <> ?
        `).all(categoriaId, id) as {
          id: number;
          palabra: string;
        }[];

        const duplicada = existentes.some(
          item => normalizarTexto(item.palabra) === normalizada
        );

        if (duplicada) return false;

        db.prepare(`
          UPDATE palabras_clave
          SET palabra = ?, categoria_id = ?
          WHERE id = ?
        `).run(palabra.trim(), categoriaId, id);

        return true;
      });

      if (!actualizar()) {
        res.status(409).json({
          error: 'Ya existe esa palabra en la categoría'
        });
        return;
      }

      res.json({
        id,
        palabra: palabra.trim(),
        categoria_id: categoriaId,
        categoria: categoria.nombre,
        mensaje: 'Palabra clave actualizada correctamente'
      });
    } catch (error) {
      console.error('Error al editar palabra:', error);
      res.status(500).json({
        error: 'No se pudo actualizar la palabra clave'
      });
    }
  });

  // ADM-03: Quitar palabra clave
  router.delete('/palabras-clave/:id', ...proteger, (req, res) => {
    const parametro = req.params.id;
    const id = typeof parametro === 'string'
      ? Number(parametro)
      : NaN;

    if (
      typeof parametro !== 'string' ||
      !/^[1-9]\d*$/.test(parametro) ||
      !Number.isSafeInteger(id)
    ) {
      res.status(400).json({
        error: 'ID inválido'
      });
      return;
    }

    try {
      const resultado = db.prepare(`
        DELETE FROM palabras_clave
        WHERE id = ?
      `).run(id);

      if (resultado.changes === 0) {
        res.status(404).json({
          error: 'Palabra clave no encontrada'
        });
        return;
      }

      res.json({
        id,
        mensaje: 'Palabra clave eliminada del diccionario'
      });
    } catch (error) {
      console.error('Error al quitar palabra:', error);
      res.status(500).json({
        error: 'No se pudo quitar la palabra clave'
      });
    }
  });

  return router;
}
