import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { aplicarMigraciones } from './migrations';

describe('migración del técnico sugerido', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('recupera sugerencias previas de correcciones y es idempotente', () => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE usuarios (id INTEGER PRIMARY KEY);
      INSERT INTO usuarios (id) VALUES (7), (9);
      CREATE TABLE tickets (id INTEGER PRIMARY KEY, tecnico_id INTEGER);
      CREATE TABLE correcciones (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        campo TEXT NOT NULL,
        valor_sugerido TEXT
      );
      INSERT INTO tickets (id, tecnico_id) VALUES (1, 9), (2, 9), (3, 7), (4, NULL);
      INSERT INTO correcciones (ticket_id, campo, valor_sugerido)
        VALUES (1, 'tecnico', '7'), (2, 'tecnico', NULL);
    `);

    aplicarMigraciones(db);
    aplicarMigraciones(db);

    expect(db.prepare('SELECT id, tecnico_sugerido_id FROM tickets ORDER BY id').all()).toEqual([
      { id: 1, tecnico_sugerido_id: 7 },
      { id: 2, tecnico_sugerido_id: null },
      { id: 3, tecnico_sugerido_id: 7 },
      { id: 4, tecnico_sugerido_id: null },
    ]);
  });
});
