
import { Router, type RequestHandler } from 'express';
import { db } from '../../db/connection';

interface SeguridadAdmin {
  requiereAutenticacion?: RequestHandler;
  requiereAdministrador?: RequestHandler;
}

const accesoDenegado: RequestHandler = (_req, res) => {
  res.status(401).json({
    error: 'Autenticación administrativa no configurada'
  });
};

function validarNombre(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;

  const nombre = valor.trim();
  return nombre.length > 0 && nombre.length <= 80
    ? nombre
    : null;
}


function validarId(valor: string | string[] | undefined): number | null {
  if (typeof valor !== 'string') {
    return null;
  }

  if (!/^[1-9]\d*$/.test(valor)) {
    return null;
  }

  const id = Number(valor);

  return Number.isSafeInteger(id) ? id : null;
}


export function crearCatalogosCrudRouter(
  seguridad: SeguridadAdmin = {}
): Router {
  const router = Router();

  const proteger: RequestHandler[] =
    seguridad.requiereAutenticacion &&
    seguridad.requiereAdministrador
      ? [
          seguridad.requiereAutenticacion,
          seguridad.requiereAdministrador
        ]
      : [accesoDenegado];

  // ADM-02: Registrar grupo
  router.post('/grupos', ...proteger, (req, res) => {
    const nombre = validarNombre(req.body?.nombre);

    if (!nombre) {
      res.status(400).json({
        error: 'El nombre debe tener entre 1 y 80 caracteres'
      });
      return;
    }

    try {
      const duplicado = db.prepare(`
        SELECT id FROM grupos
        WHERE nombre = ? COLLATE NOCASE
      `).get(nombre);

      if (duplicado) {
        res.status(409).json({
          error: 'Ya existe un grupo con ese nombre'
        });
        return;
      }

      const resultado = db.prepare(`
        INSERT INTO grupos (nombre, activo)
        VALUES (?, 1)
      `).run(nombre);

      res.status(201).json({
        id: Number(resultado.lastInsertRowid),
        nombre,
        activo: true
      });
    } catch (error) {
      console.error('Error al crear grupo:', error);
      res.status(500).json({
        error: 'No se pudo registrar el grupo'
      });
    }
  });

  // ADM-02: Editar grupo
  router.patch('/grupos/:id', ...proteger, (req, res) => {
    const id = validarId(req.params.id);
    const nombre = validarNombre(req.body?.nombre);

    if (!id || !nombre) {
      res.status(400).json({
        error: 'ID o nombre inválido'
      });
      return;
    }

    try {
      const grupo = db.prepare(`
        SELECT id, activo FROM grupos WHERE id = ?
      `).get(id) as { id: number; activo: number } | undefined;

      if (!grupo) {
        res.status(404).json({
          error: 'Grupo no encontrado'
        });
        return;
      }

      if (!grupo.activo) {
        res.status(409).json({
          error: 'No se puede editar un grupo inactivo'
        });
        return;
      }

      const duplicado = db.prepare(`
        SELECT id FROM grupos
        WHERE nombre = ? COLLATE NOCASE AND id <> ?
      `).get(nombre, id);

      if (duplicado) {
        res.status(409).json({
          error: 'Ya existe otro grupo con ese nombre'
        });
        return;
      }

      db.prepare(`
        UPDATE grupos SET nombre = ? WHERE id = ?
      `).run(nombre, id);

      res.json({ id, nombre, activo: true });
    } catch (error) {
      console.error('Error al editar grupo:', error);
      res.status(500).json({
        error: 'No se pudo actualizar el grupo'
      });
    }
  });

  // ADM-02: Desactivar sin eliminar
  router.patch('/grupos/:id/desactivar', ...proteger, (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const grupo = db.prepare(`
        SELECT id, activo FROM grupos WHERE id = ?
      `).get(id) as { id: number; activo: number } | undefined;

      if (!grupo) {
        res.status(404).json({
          error: 'Grupo no encontrado'
        });
        return;
      }

      // Evitar dejar categorías activas sin un grupo activo.
      const referencias = db.prepare(`
        SELECT COUNT(*) AS total
        FROM categorias
        WHERE grupo_id = ? AND activa = 1
      `).get(id) as { total: number };

      if (referencias.total > 0) {
        res.status(409).json({
          error: 'Reasigna las categorías activas antes de desactivar el grupo'
        });
        return;
      }

      db.prepare(`
        UPDATE grupos SET activo = 0 WHERE id = ?
      `).run(id);

      res.json({
        id,
        activo: false,
        mensaje: 'Grupo desactivado correctamente'
      });
    } catch (error) {
      console.error('Error al desactivar grupo:', error);
      res.status(500).json({
        error: 'No se pudo desactivar el grupo'
      });
    }
  });

  // ADM-02: Registrar categoría
  router.post('/categorias', ...proteger, (req, res) => {
    const nombre = validarNombre(req.body?.nombre);
    const grupoId = req.body?.grupo_id;

    if (!nombre || !Number.isSafeInteger(grupoId) || grupoId <= 0) {
      res.status(400).json({
        error: 'Nombre o ID de grupo inválido'
      });
      return;
    }

    try {
      const grupo = db.prepare(`
        SELECT id FROM grupos
        WHERE id = ? AND activo = 1
      `).get(grupoId);

      if (!grupo) {
        res.status(400).json({
          error: 'El grupo no existe o está inactivo'
        });
        return;
      }

      const duplicado = db.prepare(`
        SELECT id FROM categorias
        WHERE nombre = ? COLLATE NOCASE
      `).get(nombre);

      if (duplicado) {
        res.status(409).json({
          error: 'Ya existe una categoría con ese nombre'
        });
        return;
      }

      const resultado = db.prepare(`
        INSERT INTO categorias (nombre, grupo_id, activa)
        VALUES (?, ?, 1)
      `).run(nombre, grupoId);

      res.status(201).json({
        id: Number(resultado.lastInsertRowid),
        nombre,
        grupo_id: grupoId,
        activa: true
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      res.status(500).json({
        error: 'No se pudo registrar la categoría'
      });
    }
  });

  // ADM-02: Editar categoría
  router.patch('/categorias/:id', ...proteger, (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const tieneNombre = Object.prototype.hasOwnProperty.call(
      req.body ?? {}, 'nombre'
    );
    const tieneGrupo = Object.prototype.hasOwnProperty.call(
      req.body ?? {}, 'grupo_id'
    );

    if (!tieneNombre && !tieneGrupo) {
      res.status(400).json({
        error: 'Debes proporcionar nombre o grupo_id'
      });
      return;
    }

    try {
      const categoria = db.prepare(`
        SELECT id, nombre, grupo_id, activa
        FROM categorias WHERE id = ?
      `).get(id) as {
        id: number;
        nombre: string;
        grupo_id: number | null;
        activa: number;
      } | undefined;

      if (!categoria) {
        res.status(404).json({
          error: 'Categoría no encontrada'
        });
        return;
      }

      if (!categoria.activa) {
        res.status(409).json({
          error: 'No se puede editar una categoría inactiva'
        });
        return;
      }

      const nombre = tieneNombre
        ? validarNombre(req.body.nombre)
        : categoria.nombre;

      const grupoId = tieneGrupo
        ? req.body.grupo_id
        : categoria.grupo_id;

      if (!nombre || !Number.isSafeInteger(grupoId) || grupoId <= 0) {
        res.status(400).json({
          error: 'Nombre o grupo_id inválido'
        });
        return;
      }

      const grupo = db.prepare(`
        SELECT id FROM grupos
        WHERE id = ? AND activo = 1
      `).get(grupoId);

      if (!grupo) {
        res.status(400).json({
          error: 'El grupo no existe o está inactivo'
        });
        return;
      }

      const duplicado = db.prepare(`
        SELECT id FROM categorias
        WHERE nombre = ? COLLATE NOCASE AND id <> ?
      `).get(nombre, id);

      if (duplicado) {
        res.status(409).json({
          error: 'Ya existe otra categoría con ese nombre'
        });
        return;
      }

      db.prepare(`
        UPDATE categorias
        SET nombre = ?, grupo_id = ?
        WHERE id = ?
      `).run(nombre, grupoId, id);

      res.json({
        id,
        nombre,
        grupo_id: grupoId,
        activa: true
      });
    } catch (error) {
      console.error('Error al editar categoría:', error);
      res.status(500).json({
        error: 'No se pudo actualizar la categoría'
      });
    }
  });

  // ADM-02: Desactivar categoría sin eliminarla
  router.patch('/categorias/:id/desactivar', ...proteger, (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    try {
      const categoria = db.prepare(`
        SELECT id FROM categorias WHERE id = ?
      `).get(id);

      if (!categoria) {
        res.status(404).json({
          error: 'Categoría no encontrada'
        });
        return;
      }

      db.prepare(`
        UPDATE categorias
        SET activa = 0
        WHERE id = ?
      `).run(id);

      res.json({
        id,
        activa: false,
        mensaje: 'Categoría desactivada correctamente'
      });
    } catch (error) {
      console.error('Error al desactivar categoría:', error);
      res.status(500).json({
        error: 'No se pudo desactivar la categoría'
      });
    }
  });

  return router;
}
