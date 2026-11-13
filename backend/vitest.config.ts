import { defineConfig } from 'vitest/config';

/**
 * Configuración de pruebas del backend.
 *
 * `env` fija DB_FILE=':memory:' ANTES de cargar cualquier módulo, de modo que
 * `db/connection.ts` abra una base SQLite en memoria. Cada archivo de prueba se
 * ejecuta aislado (comportamiento por defecto de Vitest), por lo que obtiene su
 * propia base: los tests nunca leen ni escriben `data/smarttriage.db`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DB_FILE: ':memory:',
      NODE_ENV: 'test',
      SESSION_SECRET: 'test-secret-solo-pruebas-0123456789abcdef',
    },
    setupFiles: ['./src/test/setup.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
