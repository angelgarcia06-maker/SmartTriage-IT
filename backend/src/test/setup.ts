/**
 * Setup de pruebas (AUTH).
 *
 * `vitest.config.ts` ya fija DB_FILE=':memory:' antes de cargar módulos, así que
 * `db/connection.ts` abre una base en memoria propia de este archivo de prueba.
 * Aquí solo se aplica el esquema y el seed de demostración.
 *
 * Resultado: ninguna prueba modifica `data/smarttriage.db` ni usuarios reales.
 */
import '../db/seed';
