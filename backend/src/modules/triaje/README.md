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

## TRI-02 · Matriz de prioridad (`prioridad.ts`)

`calcularPrioridad(impacto, urgencia)` es una función pura: solo usa impacto y urgencia (nunca la descripción ni la categoría). Valores inválidos lanzan error.

| Impacto \ Urgencia | Alta | Media | Baja |
|---|---|---|---|
| **Alto** | Crítica | Alta | Media |
| **Medio** | Alta | Media | Baja |
| **Bajo** | Media | Baja | Baja |

> Matriz ITIL 3×3. El issue solo fija "Alto/Alta = Crítica"; confirmar el resto con el equipo. Pruebas: `prioridad.test.ts` (9 combinaciones + validación).

## TRI-03 · Sugerir grupo y técnico (`sugerir.ts`)

`sugerir({titulo?, descripcion, impacto, urgencia})` devuelve exactamente `SugerenciaTriaje`:

```ts
{ categoria_id, categoria, palabra_activadora, es_otros, prioridad, grupo_id, tecnico_id }
```

- Categoría: `clasificar(titulo + descripcion)`.
- Prioridad: `calcularPrioridad(impacto, urgencia)`.
- Grupo: el de la categoría (`categorias.grupo_id`), solo si el grupo está activo; si no, `null`.
- Técnico (`recomendarTecnico`): técnicos activos del grupo; gana el que tiene menos tickets en **Nuevo, Asignado o En proceso**; empate → menor id. Sin técnicos → `null` (no se inventa).

## TRI-04 · Aceptar y corregir (`decision.ts`, frontend `PanelSugerencia.tsx`)

`registrarDecision(ticketId, decision, usuarioId)` en una transacción:
- guarda `categoria_final_id`, `prioridad_final`, `grupo_final_id`, `tecnico_id`, `aceptada_sin_correccion` y `fecha_decision`;
- conserva los campos `*_sugerido*` originales;
- inserta una fila en `correcciones` por campo cambiado (`categoria`, `prioridad`, `grupo`, `tecnico`) con valor sugerido y final (quitar un técnico/grupo se guarda como `ninguno`);
- añade una fila a `historial` (nunca lo sobrescribe);
- un segundo intento sobre el mismo ticket → error 409, sin filas nuevas.
- Valida categoría activa, grupo activo y que el técnico sea técnico activo del grupo final (400).
- **No se permite asignar un técnico cuando no existe un grupo resolutor final** (`grupo_final_id: null` + `tecnico_id` no nulo → 400, sin persistir cambios).

Supuesto: la tabla no tiene `tecnico_sugerido_id`, así que el técnico sugerido es el `tickets.tecnico_id` que guarda TICK-01 al crear el ticket.

**Métricas (ADM-04):** usar `CONDICION_DECISION_CONFIRMADA` para excluir tickets sin decisión:
```ts
import { CONDICION_DECISION_CONFIRMADA } from '../triaje/decision';
db.prepare(`SELECT ... FROM tickets WHERE ${CONDICION_DECISION_CONFIRMADA}`);
```

## Rutas (`rutas.ts`) — montar en `app.ts` (Integrante 5)

```ts
import { crearRutasTriaje } from './modules/triaje/rutas';
app.use('/api', crearRutasTriaje({ requiereRol: roleRequired })); // roleRequired de AUTH-03
```

| Método y ruta | Roles | Respuestas |
|---|---|---|
| `POST /api/triaje/sugerir` | agente, administrador | 200 `SugerenciaTriaje` · 400 datos inválidos · 401 · 403 |
| `POST /api/tickets/:id/decision` | agente, administrador | 201 resultado · 400 · 401 · 403 · 404 · 409 ya decidido |

Mientras AUTH-03 no esté listo se usa `rolRequeridoProvisional`, que lee `req.session.usuario = { id, rol }`.

## Pruebas

`npm test` — 63 pruebas del módulo con SQLite en memoria (`fixture.ts` replica el seed): clasificador, matriz, sugerencia/técnico, decisión y rutas HTTP con supertest.
