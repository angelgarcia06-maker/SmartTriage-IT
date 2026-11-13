PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS grupos (
 id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE TABLE IF NOT EXISTS usuarios (
 id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, rol TEXT NOT NULL CHECK(rol IN ('agente','tecnico','administrador')),
 activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1)), grupo_id INTEGER REFERENCES grupos(id)
);
CREATE TABLE IF NOT EXISTS categorias (
 id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, grupo_id INTEGER REFERENCES grupos(id),
 activa INTEGER NOT NULL DEFAULT 1 CHECK(activa IN (0,1))
);
CREATE TABLE IF NOT EXISTS palabras_clave (
 id INTEGER PRIMARY KEY AUTOINCREMENT, categoria_id INTEGER NOT NULL REFERENCES categorias(id),
 palabra TEXT NOT NULL, UNIQUE(categoria_id,palabra)
);
CREATE TABLE IF NOT EXISTS tickets (
 id INTEGER PRIMARY KEY AUTOINCREMENT, solicitante TEXT NOT NULL, titulo TEXT NOT NULL, descripcion TEXT NOT NULL,
 impacto TEXT NOT NULL CHECK(impacto IN ('Alto','Medio','Bajo')),
 urgencia TEXT NOT NULL CHECK(urgencia IN ('Alta','Media','Baja')),
 estado TEXT NOT NULL DEFAULT 'Nuevo' CHECK(estado IN ('Nuevo','Asignado','En proceso','Resuelto','Cerrado')),
 fecha_creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 creado_por INTEGER NOT NULL REFERENCES usuarios(id), tecnico_id INTEGER REFERENCES usuarios(id),
 tecnico_sugerido_id INTEGER REFERENCES usuarios(id),
 categoria_sugerida_id INTEGER REFERENCES categorias(id), prioridad_sugerida TEXT CHECK(prioridad_sugerida IN ('Crítica','Alta','Media','Baja')),
 grupo_sugerido_id INTEGER REFERENCES grupos(id), palabra_activadora TEXT,
 categoria_final_id INTEGER REFERENCES categorias(id), prioridad_final TEXT CHECK(prioridad_final IN ('Crítica','Alta','Media','Baja')),
 grupo_final_id INTEGER REFERENCES grupos(id), aceptada_sin_correccion INTEGER CHECK(aceptada_sin_correccion IN (0,1)),
 fecha_decision TEXT
);
CREATE TABLE IF NOT EXISTS historial (
 id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES tickets(id), usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
 accion TEXT NOT NULL, valor_anterior TEXT, valor_nuevo TEXT,
 fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS correcciones (
 id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES tickets(id), campo TEXT NOT NULL,
 valor_sugerido TEXT, valor_final TEXT NOT NULL, usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
 fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_fecha ON tickets(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_tickets_tecnico ON tickets(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tecnico_estado ON tickets(tecnico_id, estado);
CREATE INDEX IF NOT EXISTS idx_tickets_cat_final ON tickets(categoria_final_id);
CREATE INDEX IF NOT EXISTS idx_correcciones_ticket ON correcciones(ticket_id);
CREATE INDEX IF NOT EXISTS idx_correcciones_ticket_campo ON correcciones(ticket_id, campo);
CREATE INDEX IF NOT EXISTS idx_historial_ticket_fecha ON historial(ticket_id, fecha, id);
CREATE INDEX IF NOT EXISTS idx_palabras_categoria ON palabras_clave(categoria_id);
