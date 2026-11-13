# Triaje — Integrante 3
Implementar clasificar(descripcion), calcularPrioridad(impacto, urgencia), sugerir(ticket) y registrarDecision(ticketId,decision,usuarioId).

## TRI-01 · Clasificador Nivel 1 (`clasificador.ts`)

```ts
import { clasificar } from '../triaje/clasificador';
clasificar('No me conecta el wifi');
// { categoria_id: 3, categoria: 'Red', palabra_activadora: 'wifi', es_otros: false,
//   explicacion: 'Coincide con la palabra clave "wifi" de Red.' }
```

- Lee las palabras clave desde SQLite (`palabras_clave` + `categorias` activas). No hay palabras escritas en el código: lo que Admin agregue en el diccionario se usa en la siguiente llamada.
- Normaliza texto y palabras: sin tildes, minúsculas, signos como separadores y espacios repetidos (`normalizar.ts`).
- Solo coincide con palabras o frases completas: `teclado` no coincide con `tecladoinalambrico`, `error` no coincide con `errores`.
- Desempate determinista:
  1. frase coincidente más larga (`usuario bloqueado` gana a `usuario`);
  2. más palabras clave coincidentes de la misma categoría;
  3. menor `categoria_id`.
- Sin coincidencias devuelve la categoría **Otros** con `es_otros: true`, `palabra_activadora: null` y una explicación.
- `clasificar(descripcion, conexion?)` acepta una conexión opcional (los tests usan SQLite en memoria). `clasificarConDiccionario` es la versión pura para fixtures.

### Ejemplos (diccionario del seed)

| Descripción | Categoría | Activadora |
|---|---|---|
| No me conecta el wifi | Red | wifi |
| El teclado no escribe | Hardware | teclado |
| olvide mi contrasena | Accesos | contraseña |
| El teclado da error | Hardware | teclado (gana a "error" por longitud) |
| outlook y monitor | Hardware | monitor (empate → menor id) |
| La cafetera hace ruido | Otros (`es_otros: true`) | — |

Pruebas: `backend/src/modules/triaje/clasificador.test.ts` (`npm test`).
