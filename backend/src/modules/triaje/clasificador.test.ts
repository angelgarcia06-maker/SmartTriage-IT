import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { clasificar, clasificarConDiccionario, type Diccionario } from './clasificador';
import { contieneFraseCompleta, normalizarTexto } from './normalizar';

/** Base en memoria con el schema real y el mismo diccionario que seed.ts. */
function crearBaseDePrueba(): Database.Database {
  const bd = new Database(':memory:');
  bd.exec(fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8'));
  const categorias: [string, string[]][] = [
    ['Hardware', ['teclado', 'pantalla', 'impresora', 'mouse', 'monitor']],
    ['Software', ['programa', 'aplicación', 'instalar', 'licencia', 'error']],
    ['Red', ['wifi', 'internet', 'router', 'conexión', 'ethernet']],
    ['Accesos', ['contraseña', 'usuario bloqueado', 'iniciar sesión', 'permiso']],
    ['Correo', ['correo', 'outlook', 'email', 'bandeja', 'adjunto']],
    ['Otros', []],
  ];
  const insCat = bd.prepare('INSERT INTO categorias(nombre) VALUES (?)');
  const insPal = bd.prepare('INSERT INTO palabras_clave(categoria_id,palabra) VALUES (?,?)');
  for (const [nombre, palabras] of categorias) {
    const id = Number(insCat.run(nombre).lastInsertRowid);
    for (const p of palabras) insPal.run(id, p);
  }
  return bd;
}

function idCategoria(bd: Database.Database, nombre: string): number {
  return (bd.prepare('SELECT id FROM categorias WHERE nombre=?').get(nombre) as { id: number }).id;
}

describe('normalizarTexto', () => {
  it('quita tildes, mayúsculas, signos y espacios repetidos', () => {
    expect(normalizarTexto('  ¡No hay   WiFi!  ')).toBe('no hay wifi');
    expect(normalizarTexto('CONTRASEÑA, Conexión')).toBe('contrasena conexion');
  });
  it('detecta solo palabras o frases completas', () => {
    expect(contieneFraseCompleta('mi teclado falla', 'teclado')).toBe(true);
    expect(contieneFraseCompleta('tecladoinalambrico roto', 'teclado')).toBe(false);
    expect(contieneFraseCompleta('el usuario esta bloqueado', 'usuario bloqueado')).toBe(false);
    expect(contieneFraseCompleta('', '')).toBe(false);
  });
});

describe('clasificar (lee el diccionario desde SQLite)', () => {
  let bd: Database.Database;
  beforeEach(() => {
    bd = crearBaseDePrueba();
  });

  it('frase con wifi → Red', () => {
    const r = clasificar('No me conecta el wifi de la oficina', bd);
    expect(r).toMatchObject({ categoria: 'Red', palabra_activadora: 'wifi', es_otros: false });
    expect(r.categoria_id).toBe(idCategoria(bd, 'Red'));
  });

  it('teclado → Hardware', () => {
    expect(clasificar('El teclado no escribe', bd)).toMatchObject({ categoria: 'Hardware', palabra_activadora: 'teclado', es_otros: false });
  });

  it('texto desconocido → Otros con es_otros=true y explicación', () => {
    const r = clasificar('La cafetera del piso 3 hace ruido', bd);
    expect(r).toMatchObject({ categoria: 'Otros', palabra_activadora: null, es_otros: true });
    expect(r.categoria_id).toBe(idCategoria(bd, 'Otros'));
    expect(r.explicacion).toMatch(/Otros/);
  });

  it('texto vacío → Otros', () => {
    expect(clasificar('   ', bd).es_otros).toBe(true);
  });

  describe('tildes y mayúsculas', () => {
    it('sin tilde en el texto coincide con palabra con tilde', () => {
      expect(clasificar('olvide mi contrasena', bd)).toMatchObject({ categoria: 'Accesos', palabra_activadora: 'contraseña' });
      expect(clasificar('falla la conexion', bd)).toMatchObject({ categoria: 'Red', palabra_activadora: 'conexión' });
    });
    it('mayúsculas y tildes extra en el texto', () => {
      expect(clasificar('NO PUEDO ABRIR LA APLICACIÓN', bd)).toMatchObject({ categoria: 'Software', palabra_activadora: 'aplicación' });
      expect(clasificar('Ínternet lento', bd).categoria).toBe('Red');
    });
    it('frases de varias palabras con espacios y signos extra', () => {
      expect(clasificar('No puedo   iniciar,sesión hoy', bd)).toMatchObject({ categoria: 'Accesos', palabra_activadora: 'iniciar sesión' });
    });
  });

  describe('límites de palabra', () => {
    it('no coincide dentro de otra palabra', () => {
      expect(clasificar('reviso mi emailing semanal', bd).es_otros).toBe(true); // "email" dentro de "emailing"
      expect(clasificar('los errores del sistema', bd).es_otros).toBe(true); // "error" dentro de "errores"
    });
    it('coincide con signos alrededor', () => {
      expect(clasificar('(router) caído!', bd).categoria).toBe('Red');
    });
  });

  describe('desempates deterministas', () => {
    it('gana la frase más larga', () => {
      // "teclado" (7) vence a "error" (5) de Software
      expect(clasificar('el teclado da error', bd)).toMatchObject({ categoria: 'Hardware', palabra_activadora: 'teclado' });
      // "usuario bloqueado" vence a una palabra corta de otra categoría
      bd.prepare('INSERT INTO palabras_clave(categoria_id,palabra) VALUES (?,?)').run(idCategoria(bd, 'Correo'), 'usuario');
      expect(clasificar('usuario bloqueado en el correo', bd)).toMatchObject({ categoria: 'Accesos', palabra_activadora: 'usuario bloqueado' });
    });

    it('a igual longitud gana la categoría con más coincidencias', () => {
      // Hardware: "monitor"(7) → 1 coincidencia; Correo: "outlook"(7) + "bandeja"(7) → 2 coincidencias.
      expect(clasificar('monitor, outlook y bandeja', bd)).toMatchObject({ categoria: 'Correo' });
    });

    it('empate total → categoría de menor id, siempre igual', () => {
      // "monitor"(7, Hardware id menor) vs "outlook"(7, Correo): 1 coincidencia cada una
      const r1 = clasificar('outlook y monitor', bd);
      const r2 = clasificar('monitor y outlook', bd);
      expect(r1).toMatchObject({ categoria: 'Hardware', palabra_activadora: 'monitor' });
      expect(r2).toEqual(r1);
    });

    it('dentro de una categoría la activadora es la frase más larga', () => {
      expect(clasificar('el router no da internet', bd)).toMatchObject({ categoria: 'Red', palabra_activadora: 'internet' });
    });
  });

  describe('diccionario configurable (sin hardcode)', () => {
    it('una palabra nueva en SQLite cambia la clasificación', () => {
      expect(clasificar('se cayó la vpn', bd).es_otros).toBe(true);
      bd.prepare('INSERT INTO palabras_clave(categoria_id,palabra) VALUES (?,?)').run(idCategoria(bd, 'Red'), 'VPN');
      expect(clasificar('se cayó la vpn', bd)).toMatchObject({ categoria: 'Red', palabra_activadora: 'VPN' });
    });
    it('ignora categorías inactivas', () => {
      bd.prepare('UPDATE categorias SET activa=0 WHERE nombre=?').run('Red');
      expect(clasificar('no hay wifi', bd).es_otros).toBe(true);
    });
    it('falla con mensaje claro si no existe la categoría Otros', () => {
      bd.prepare("UPDATE categorias SET nombre='Varios' WHERE nombre='Otros'").run();
      expect(() => clasificar('hola', bd)).toThrow(/Otros/);
    });
  });
});

describe('clasificarConDiccionario (función pura)', () => {
  it('funciona con un fixture sin base de datos', () => {
    const dic: Diccionario = {
      entradas: [{ palabra_id: 1, palabra: 'wifi', categoria_id: 3, categoria: 'Red' }],
      otros: { id: 6, nombre: 'Otros' },
    };
    expect(clasificarConDiccionario('sin WIFI', dic)).toMatchObject({ categoria_id: 3, es_otros: false });
    expect(clasificarConDiccionario('nada', dic)).toMatchObject({ categoria_id: 6, es_otros: true });
  });
});
