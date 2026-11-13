import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { obtenerMetricas } from '../modules/admin/metricas.service';
import { cambiarEstadoTicket, crearTicket, type DatosTicket, type EstadoTicket } from '../modules/tickets/tickets.service';
import { recomendarTecnico, sugerir } from '../modules/triaje/sugerir';
import { registrarDecision } from '../modules/triaje/decision';
import { aplicarMigraciones } from './migrations';

const repoRoot = path.resolve(__dirname, '../../..');
const rutaDatos = path.join(repoRoot, 'data');
const rutaDirectorioDemo = path.join(rutaDatos, 'demo');
const rutaBaseDemo = path.join(rutaDirectorioDemo, 'smarttriage-demo.db');
const rutaEsquema = path.join(__dirname, 'schema.sql');
const marcaDemo = 'smarttriage-demo-seed-v1';

const grupos = ['Soporte general', 'Redes y conectividad', 'Aplicaciones', 'Identidades y correo'];
const categorias: [string, string, string[]][] = [
  ['Hardware', 'Soporte general', ['teclado', 'pantalla', 'impresora', 'mouse', 'monitor']],
  ['Software', 'Aplicaciones', ['programa', 'aplicación', 'instalar', 'licencia', 'error']],
  ['Red', 'Redes y conectividad', ['wifi', 'internet', 'router', 'conexión', 'ethernet']],
  ['Accesos', 'Identidades y correo', ['contraseña', 'usuario bloqueado', 'iniciar sesión', 'permiso']],
  ['Correo', 'Identidades y correo', ['correo', 'outlook', 'email', 'bandeja', 'adjunto']],
  ['Otros', 'Soporte general', []],
];

const casos: { categoria: string; titulo: string; descripcion: string }[] = [
  { categoria: 'Hardware', titulo: 'Monitor con imagen intermitente', descripcion: 'El monitor pierde imagen al mover el cable de la estación.' },
  { categoria: 'Hardware', titulo: 'Impresora de recepción sin respuesta', descripcion: 'La impresora enciende pero no completa los trabajos enviados.' },
  { categoria: 'Hardware', titulo: 'Teclado con teclas atascadas', descripcion: 'Varias teclas del teclado no responden durante la captura.' },
  { categoria: 'Hardware', titulo: 'Mouse desconectado en laboratorio', descripcion: 'El mouse deja de funcionar al conectar otros periféricos.' },
  { categoria: 'Hardware', titulo: 'Pantalla con líneas verticales', descripcion: 'La pantalla del equipo muestra líneas desde el inicio de turno.' },
  { categoria: 'Hardware', titulo: 'Monitor sin señal después de reinicio', descripcion: 'El monitor indica que no recibe señal de la computadora.' },
  { categoria: 'Hardware', titulo: 'Impresora imprime hojas en blanco', descripcion: 'La impresora de archivo expulsa hojas sin contenido.' },
  { categoria: 'Software', titulo: 'Aplicación de inventario se cierra', descripcion: 'La aplicación muestra un error y se cierra al guardar.' },
  { categoria: 'Software', titulo: 'Programa contable no inicia', descripcion: 'El programa queda cargando y no muestra la pantalla principal.' },
  { categoria: 'Software', titulo: 'Instalar actualización de nómina', descripcion: 'Se requiere instalar la versión vigente de la aplicación de nómina.' },
  { categoria: 'Software', titulo: 'Licencia de diseño vencida', descripcion: 'El programa de diseño indica que la licencia ya expiró.' },
  { categoria: 'Software', titulo: 'Error al exportar reportes', descripcion: 'La aplicación genera un error al exportar el informe mensual.' },
  { categoria: 'Software', titulo: 'Aplicación de asistencia lenta', descripcion: 'La aplicación tarda varios minutos en abrir cada registro.' },
  { categoria: 'Software', titulo: 'Programa de citas no guarda cambios', descripcion: 'El programa pierde la información al confirmar una cita.' },
  { categoria: 'Red', titulo: 'WiFi intermitente en sala norte', descripcion: 'La conexión wifi se pierde varias veces durante las reuniones.' },
  { categoria: 'Red', titulo: 'Sin conexión a internet en recepción', descripcion: 'Los equipos no tienen conexión a internet desde esta mañana.' },
  { categoria: 'Red', titulo: 'Router reinicia cada hora', descripcion: 'El router reinicia y corta la conexión de toda el área.' },
  { categoria: 'Red', titulo: 'Conexión ethernet sin dirección', descripcion: 'El equipo conectado por ethernet no obtiene conexión.' },
  { categoria: 'Red', titulo: 'WiFi no disponible en capacitación', descripcion: 'La red wifi no aparece en los equipos del aula.' },
  { categoria: 'Red', titulo: 'Internet lento en laboratorio', descripcion: 'La conexión a internet se degrada al iniciar las prácticas.' },
  { categoria: 'Red', titulo: 'Conexión de red se interrumpe', descripcion: 'La conexión de red cae al transferir archivos grandes.' },
  { categoria: 'Accesos', titulo: 'Contraseña institucional rechazada', descripcion: 'La contraseña vigente no permite iniciar sesión en el portal.' },
  { categoria: 'Accesos', titulo: 'Usuario bloqueado después de varios intentos', descripcion: 'El usuario bloqueado no puede entrar al equipo asignado.' },
  { categoria: 'Accesos', titulo: 'No puedo iniciar sesión en el sistema', descripcion: 'El formulario no acepta mis credenciales de trabajo.' },
  { categoria: 'Accesos', titulo: 'Permiso insuficiente en carpeta', descripcion: 'Necesito permiso para consultar la carpeta compartida del área.' },
  { categoria: 'Accesos', titulo: 'Restablecer contraseña de colaborador', descripcion: 'La contraseña temporal ya no funciona y requiere restablecimiento.' },
  { categoria: 'Accesos', titulo: 'Usuario bloqueado en portal interno', descripcion: 'El usuario bloqueado recibe un aviso de cuenta suspendida.' },
  { categoria: 'Accesos', titulo: 'Solicitar permiso para módulo de compras', descripcion: 'El perfil actual no muestra las opciones del módulo de compras.' },
  { categoria: 'Correo', titulo: 'Correo institucional no sincroniza', descripcion: 'El correo institucional dejó de sincronizar en el equipo móvil.' },
  { categoria: 'Correo', titulo: 'Outlook solicita iniciar sesión repetidamente', descripcion: 'Outlook vuelve a pedir credenciales cada pocos minutos.' },
  { categoria: 'Correo', titulo: 'Adjunto no aparece en bandeja recibida', descripcion: 'El adjunto enviado por un proveedor no se muestra en la bandeja.' },
  { categoria: 'Correo', titulo: 'Email institucional rebota al enviar', descripcion: 'El email enviado a un área interna regresa con un aviso de entrega.' },
  { categoria: 'Correo', titulo: 'Bandeja de correo tarda en actualizar', descripcion: 'La bandeja no refleja los mensajes recibidos durante la mañana.' },
  { categoria: 'Correo', titulo: 'Outlook no abre calendario compartido', descripcion: 'Outlook muestra un error al consultar el calendario del equipo.' },
  { categoria: 'Correo', titulo: 'Correo institucional sin espacio', descripcion: 'El correo institucional rechaza nuevos mensajes por falta de espacio.' },
  { categoria: 'Otros', titulo: 'Avisos del tablero llegan duplicados', descripcion: 'El tablero interno muestra dos veces el mismo aviso de mantenimiento.' },
  { categoria: 'Otros', titulo: 'Diferencia en horario de sala', descripcion: 'La reserva de la sala pequeña aparece con una hora distinta.' },
  { categoria: 'Otros', titulo: 'Solicitud de orientación para equipo nuevo', descripcion: 'El personal recién incorporado necesita una guía de recursos internos.' },
  { categoria: 'Otros', titulo: 'Información de mantenimiento desactualizada', descripcion: 'El anuncio del mantenimiento semanal conserva la fecha anterior.' },
  { categoria: 'Otros', titulo: 'Aviso interno no refleja cambio de área', descripcion: 'El directorio muestra una ubicación anterior para el equipo de trabajo.' },
];

const impactos: DatosTicket['impacto'][] = ['Alto', 'Medio', 'Bajo'];
const urgencias: DatosTicket['urgencia'][] = ['Alta', 'Media', 'Baja'];
const estadosObjetivo: EstadoTicket[] = [
  ...Array<EstadoTicket>(8).fill('Nuevo'),
  ...Array<EstadoTicket>(8).fill('Asignado'),
  ...Array<EstadoTicket>(10).fill('En proceso'),
  ...Array<EstadoTicket>(9).fill('Resuelto'),
  ...Array<EstadoTicket>(5).fill('Cerrado'),
];
const secuencia: EstadoTicket[] = ['Asignado', 'En proceso', 'Resuelto', 'Cerrado'];

interface ResumenSeed {
  total: number;
  porEstado: { nombre: string; total: number }[];
  decisiones: { aceptadas: number; corregidas: number; pendientes: number };
  historial: { total: number; cambiosEstado: number; decisiones: number };
  correcciones: number;
  integridad: string;
  metricasDashboard: ReturnType<typeof obtenerMetricas>;
}

function dentroDeRepositorio(ruta: string): boolean {
  const raiz = fs.realpathSync(repoRoot);
  let existente = path.resolve(ruta);
  while (!fs.existsSync(existente)) {
    const padre = path.dirname(existente);
    if (padre === existente) return false;
    existente = padre;
  }
  const objetivo = fs.realpathSync(existente);
  return objetivo === raiz || objetivo.startsWith(`${raiz}${path.sep}`);
}

function validarDirectorio(): void {
  if (process.env.DB_FILE) {
    throw new Error('No establezcas DB_FILE al ejecutar db:seed:demo; este comando solo usa la ruta dedicada data/demo/smarttriage-demo.db.');
  }
  if (!dentroDeRepositorio(rutaDirectorioDemo)) {
    throw new Error('La carpeta de demostración resuelve fuera del repositorio; no se modificó ninguna base.');
  }
  if (
    (fs.existsSync(rutaDatos) && fs.lstatSync(rutaDatos).isSymbolicLink())
    || (fs.existsSync(rutaDirectorioDemo) && fs.lstatSync(rutaDirectorioDemo).isSymbolicLink())
  ) {
    throw new Error('La carpeta de demostración no puede ser un enlace simbólico.');
  }
  fs.mkdirSync(rutaDirectorioDemo, { recursive: true });
  if (fs.existsSync(rutaBaseDemo) && fs.lstatSync(rutaBaseDemo).isSymbolicLink()) {
    throw new Error('La base de demostración no puede ser un enlace simbólico.');
  }
}

function leerMarca(db: Database.Database): string | undefined {
  const tabla = db.prepare(
    "SELECT 1 AS existe FROM sqlite_master WHERE type = 'table' AND name = 'smarttriage_demo_meta'",
  ).get();
  if (!tabla) return undefined;
  const registro = db.prepare('SELECT valor FROM smarttriage_demo_meta WHERE clave = ?').get('seed') as
    { valor: string } | undefined;
  return registro?.valor;
}

function resumen(db: Database.Database): ResumenSeed {
  const total = (db.prepare('SELECT COUNT(*) AS total FROM tickets').get() as { total: number }).total;
  const porEstado = db.prepare(
    'SELECT estado AS nombre, COUNT(*) AS total FROM tickets GROUP BY estado ORDER BY estado',
  ).all() as { nombre: string; total: number }[];
  const decisiones = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN aceptada_sin_correccion = 1 THEN 1 ELSE 0 END), 0) AS aceptadas,
      COALESCE(SUM(CASE WHEN aceptada_sin_correccion = 0 THEN 1 ELSE 0 END), 0) AS corregidas,
      COALESCE(SUM(CASE WHEN fecha_decision IS NULL THEN 1 ELSE 0 END), 0) AS pendientes
    FROM tickets
  `).get() as ResumenSeed['decisiones'];
  const historial = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN accion = 'Cambio de estado' THEN 1 ELSE 0 END), 0) AS cambiosEstado,
      COALESCE(SUM(CASE WHEN accion LIKE 'Sugerencia de triaje %' THEN 1 ELSE 0 END), 0) AS decisiones
    FROM historial
  `).get() as ResumenSeed['historial'];
  const correcciones = (db.prepare('SELECT COUNT(*) AS total FROM correcciones').get() as { total: number }).total;
  const integridad = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
  const referenciasRotas = db.prepare('PRAGMA foreign_key_check').all();
  if (referenciasRotas.length > 0) throw new Error('La base de demostración contiene referencias foráneas inválidas.');
  return { total, porEstado, decisiones, historial, correcciones, integridad, metricasDashboard: obtenerMetricas(db) };
}

function validarResumen(resultado: ResumenSeed): void {
  const esperados = new Map<EstadoTicket, number>([
    ['Nuevo', 8],
    ['Asignado', 8],
    ['En proceso', 10],
    ['Resuelto', 9],
    ['Cerrado', 5],
  ]);
  if (resultado.total !== 40 || resultado.integridad !== 'ok') {
    throw new Error('La base de demostración no coincide con los 40 tickets esperados o falla integrity_check.');
  }
  for (const [estado, cantidad] of esperados) {
    if (resultado.porEstado.find((fila) => fila.nombre === estado)?.total !== cantidad) {
      throw new Error(`La cantidad de tickets en estado "${estado}" no coincide con el objetivo.`);
    }
  }
  if (resultado.decisiones.aceptadas !== 25 || resultado.decisiones.corregidas !== 10 || resultado.decisiones.pendientes !== 5) {
    throw new Error('Las cantidades de decisiones no coinciden con 25 aceptadas, 10 corregidas y 5 pendientes.');
  }
  if (resultado.historial.total !== 110 || resultado.historial.cambiosEstado !== 75 || resultado.historial.decisiones !== 35) {
    throw new Error('El historial no coincide con 75 transiciones y 35 decisiones registradas.');
  }
  if (resultado.correcciones < 10) throw new Error('No se guardaron las correcciones esperadas en la tabla de correcciones.');
  const estadosDashboard = new Map(resultado.metricasDashboard.tickets.porEstado.map(({ nombre, total }) => [nombre, total]));
  if (
    resultado.metricasDashboard.tickets.total !== resultado.total
    || Array.from(esperados).some(([estado, cantidad]) => estadosDashboard.get(estado) !== cantidad)
  ) {
    throw new Error('Las métricas del Dashboard no coinciden con los tickets persistidos.');
  }
}

function crearDatosDemo(db: Database.Database): void {
  const esquema = fs.readFileSync(rutaEsquema, 'utf8');
  db.exec(esquema);
  aplicarMigraciones(db);
  db.exec(`
    CREATE TABLE smarttriage_demo_meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  const insertarGrupo = db.prepare('INSERT INTO grupos (nombre) VALUES (?)');
  for (const nombre of grupos) insertarGrupo.run(nombre);
  const idGrupo = db.prepare('SELECT id FROM grupos WHERE nombre = ?');
  const insertarCategoria = db.prepare('INSERT INTO categorias (nombre, grupo_id) VALUES (?, ?)');
  const insertarPalabra = db.prepare('INSERT INTO palabras_clave (categoria_id, palabra) VALUES (?, ?)');
  for (const [nombre, grupo, palabras] of categorias) {
    const grupoId = (idGrupo.get(grupo) as { id: number }).id;
    insertarCategoria.run(nombre, grupoId);
    const categoriaId = (db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre) as { id: number }).id;
    for (const palabra of palabras) insertarPalabra.run(categoriaId, palabra);
  }

  const hash = bcrypt.hashSync('Cambiar123!', 10);
  const insertarUsuario = db.prepare(
    'INSERT INTO usuarios (nombre, usuario, password_hash, rol, grupo_id) VALUES (?, ?, ?, ?, ?)',
  );
  insertarUsuario.run('Administrador Demo', 'admin', hash, 'administrador', null);
  const agenteId = Number(insertarUsuario.run('Agente Demo', 'agente', hash, 'agente', null).lastInsertRowid);
  for (const [usuario, nombre, grupo] of [
    ['tecnico1', 'Técnico General', 'Soporte general'],
    ['tecnico2', 'Técnico Redes', 'Redes y conectividad'],
    ['tecnico3', 'Técnico Aplicaciones', 'Aplicaciones'],
    ['tecnico4', 'Técnico Accesos', 'Identidades y correo'],
  ]) {
    const grupoId = (idGrupo.get(grupo) as { id: number }).id;
    insertarUsuario.run(nombre, usuario, hash, 'tecnico', grupoId);
  }

  const categoriasFinales = db.prepare(`
    SELECT c.id, c.nombre, c.grupo_id
    FROM categorias c
    JOIN grupos g ON g.id = c.grupo_id AND g.activo = 1
    WHERE c.activa = 1
    ORDER BY c.id
  `).all() as { id: number; nombre: string; grupo_id: number | null }[];
  const estadoParaIndice = (indice: number): EstadoTicket => estadosObjetivo[indice];

  casos.forEach((caso, indice) => {
    const datos: DatosTicket = {
      solicitante: `Solicitante de demostración ${String(indice + 1).padStart(2, '0')}`,
      titulo: caso.titulo,
      descripcion: caso.descripcion,
      impacto: impactos[indice % impactos.length],
      urgencia: urgencias[(indice * 2) % urgencias.length],
    };
    const sugerencia = sugerir(datos, db);
    const ticketId = crearTicket(datos, agenteId, db, sugerencia);

    if (indice < 25) {
      registrarDecision(ticketId, {
        categoria_final_id: sugerencia.categoria_id,
        prioridad_final: sugerencia.prioridad,
        grupo_final_id: sugerencia.grupo_id,
        tecnico_id: sugerencia.tecnico_id,
      }, agenteId, db);
    } else if (indice < 35) {
      const categoriaFinal = categoriasFinales.find((categoria) => categoria.id !== sugerencia.categoria_id);
      if (!categoriaFinal) throw new Error('No existe una categoría alternativa activa para registrar la corrección.');
      registrarDecision(ticketId, {
        categoria_final_id: categoriaFinal.id,
        prioridad_final: sugerencia.prioridad,
        grupo_final_id: categoriaFinal.grupo_id,
        tecnico_id: recomendarTecnico(categoriaFinal.grupo_id, db),
      }, agenteId, db);
    }

    const estadoObjetivo = estadoParaIndice(indice);
    const cantidadTransiciones = estadoObjetivo === 'Nuevo' ? 0 : secuencia.indexOf(estadoObjetivo) + 1;
    for (const estado of secuencia.slice(0, cantidadTransiciones)) {
      cambiarEstadoTicket(ticketId, estado, { id: agenteId, rol: 'agente' }, undefined, db);
    }
  });

  db.prepare('INSERT INTO smarttriage_demo_meta (clave, valor) VALUES (?, ?)').run('seed', marcaDemo);
}

function ejecutar(): void {
  validarDirectorio();
  const archivoExiste = fs.existsSync(rutaBaseDemo);
  if (archivoExiste) {
    const soloLectura = new Database(rutaBaseDemo, { readonly: true, fileMustExist: true });
    try {
      if (leerMarca(soloLectura) !== marcaDemo) {
        throw new Error(`Se rechazó la ruta existente ${rutaBaseDemo}: no está marcada como base de demostración de SmartTriage.`);
      }
      const resultado = resumen(soloLectura);
      validarResumen(resultado);
      console.log('La base de demostración ya contiene el seed esperado; no se modificó ningún registro.');
      console.log(JSON.stringify(resultado, null, 2));
      return;
    } finally {
      soloLectura.close();
    }
  }

  const db = new Database(rutaBaseDemo);
  db.pragma('foreign_keys = ON');
  try {
    const sembrar = db.transaction(() => crearDatosDemo(db));
    sembrar.immediate();
    const resultado = resumen(db);
    validarResumen(resultado);
    console.log(`Seed aislado creado en ${rutaBaseDemo}`);
    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    db.close();
  }
}

ejecutar();
