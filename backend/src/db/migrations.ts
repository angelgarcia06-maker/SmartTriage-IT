import type Database from 'better-sqlite3';

/**
 * Añade el dato de técnico sugerido sin perder el valor anterior en bases
 * existentes. Las decisiones previas conservan su sugerencia en correcciones.
 */
export function aplicarMigraciones(db: Database.Database): void {
  const columnas = db.pragma('table_info(tickets)') as { name: string }[];
  if (columnas.some((columna) => columna.name === 'tecnico_sugerido_id')) return;

  db.exec(`
    ALTER TABLE tickets
      ADD COLUMN tecnico_sugerido_id INTEGER REFERENCES usuarios(id);

    UPDATE tickets
       SET tecnico_sugerido_id = CASE
         WHEN EXISTS (
           SELECT 1 FROM correcciones c
            WHERE c.ticket_id = tickets.id AND c.campo = 'tecnico'
         ) THEN (
           SELECT CASE
             WHEN c.valor_sugerido IS NULL THEN NULL
             WHEN c.valor_sugerido GLOB '[0-9]*' THEN CAST(c.valor_sugerido AS INTEGER)
             ELSE NULL
           END
             FROM correcciones c
            WHERE c.ticket_id = tickets.id AND c.campo = 'tecnico'
            ORDER BY c.id
            LIMIT 1
         )
         ELSE tecnico_id
       END;
  `);
}
