import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Base SQLite en memoria con el schema real y los mismos datos que seed.ts
 * (grupos, categorías, palabras clave y usuarios). Solo para pruebas.
 */
export function crearBaseDePrueba(): Database.Database {
  const bd = new Database(':memory:');
  bd.exec(fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8'));
  const grupos = ['Soporte general', 'Redes y conectividad', 'Aplicaciones', 'Identidades y correo'];
  const categorias: [string, string, string[]][] = [
    ['Hardware', 'Soporte general', ['teclado', 'pantalla', 'impresora', 'mouse', 'monitor']],
    ['Software', 'Aplicaciones', ['programa', 'aplicación', 'instalar', 'licencia', 'error']],
    ['Red', 'Redes y conectividad', ['wifi', 'internet', 'router', 'conexión', 'ethernet']],
    ['Accesos', 'Identidades y correo', ['contraseña', 'usuario bloqueado', 'iniciar sesión', 'permiso']],
    ['Correo', 'Identidades y correo', ['correo', 'outlook', 'email', 'bandeja', 'adjunto']],
    ['Otros', 'Soporte general', []],
  ];
  const insGrupo = bd.prepare('INSERT INTO grupos(nombre) VALUES (?)');
  for (const g of grupos) insGrupo.run(g);
  const insCat = bd.prepare('INSERT INTO categorias(nombre, grupo_id) VALUES (?, ?)');
  const insPal = bd.prepare('INSERT INTO palabras_clave(categoria_id, palabra) VALUES (?, ?)');
  for (const [nombre, grupo, palabras] of categorias) {
    const id = Number(insCat.run(nombre, idGrupo(bd, grupo)).lastInsertRowid);
    for (const p of palabras) insPal.run(id, p);
  }
  const insUsuario = bd.prepare('INSERT INTO usuarios(nombre, usuario, password_hash, rol, grupo_id) VALUES (?, ?, ?, ?, ?)');
  insUsuario.run('Administrador Demo', 'admin', 'x', 'administrador', null); // id 1
  insUsuario.run('Agente Demo', 'agente', 'x', 'agente', null); // id 2
  insUsuario.run('Técnico General', 'tecnico1', 'x', 'tecnico', idGrupo(bd, 'Soporte general')); // id 3
  insUsuario.run('Técnico Redes', 'tecnico2', 'x', 'tecnico', idGrupo(bd, 'Redes y conectividad')); // id 4
  insUsuario.run('Técnico Aplicaciones', 'tecnico3', 'x', 'tecnico', idGrupo(bd, 'Aplicaciones')); // id 5
  insUsuario.run('Técnico Accesos', 'tecnico4', 'x', 'tecnico', idGrupo(bd, 'Identidades y correo')); // id 6
  return bd;
}

export function idGrupo(bd: Database.Database, nombre: string): number {
  return (bd.prepare('SELECT id FROM grupos WHERE nombre = ?').get(nombre) as { id: number }).id;
}
export function idCategoria(bd: Database.Database, nombre: string): number {
  return (bd.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre) as { id: number }).id;
}
export function idUsuario(bd: Database.Database, usuario: string): number {
  return (bd.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario) as { id: number }).id;
}

/** Crea un técnico activo en un grupo y devuelve su id. */
export function crearTecnico(bd: Database.Database, usuario: string, grupo: string): number {
  return Number(
    bd.prepare("INSERT INTO usuarios(nombre, usuario, password_hash, rol, grupo_id) VALUES (?, ?, 'x', 'tecnico', ?)")
      .run(usuario, usuario, idGrupo(bd, grupo)).lastInsertRowid,
  );
}

/** Inserta un ticket con los campos de sugerencia ya guardados (como haría TICK-01). */
export function crearTicket(
  bd: Database.Database,
  datos: { estado?: string; tecnico_id?: number | null; categoria?: string; prioridad?: string; grupo?: string | null } = {},
): number {
  const categoria = datos.categoria ?? 'Red';
  const grupo = datos.grupo === undefined ? 'Redes y conectividad' : datos.grupo;
  return Number(
    bd.prepare(
      `INSERT INTO tickets(solicitante, titulo, descripcion, impacto, urgencia, estado, creado_por, tecnico_id,
                           categoria_sugerida_id, prioridad_sugerida, grupo_sugerido_id, palabra_activadora)
       VALUES ('Ana', 'Sin wifi', 'No hay wifi', 'Alto', 'Alta', ?, ?, ?, ?, ?, ?, 'wifi')`,
    ).run(
      datos.estado ?? 'Nuevo',
      idUsuario(bd, 'agente'),
      datos.tecnico_id ?? null,
      idCategoria(bd, categoria),
      datos.prioridad ?? 'Crítica',
      grupo == null ? null : idGrupo(bd, grupo),
    ).lastInsertRowid,
  );
}
