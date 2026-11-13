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

La base conserva `tecnico_sugerido_id` de forma independiente del `tecnico_id` final. La migración idempotente recupera en bases existentes la sugerencia desde la corrección histórica del técnico cuando existe y, en los demás casos, desde la asignación original; no elimina ni reescribe el historial.

**Métricas (ADM-04):** usar `CONDICION_DECISION_CONFIRMADA` para excluir tickets sin decisión:
```ts
import { CONDICION_DECISION_CONFIRMADA } from '../triaje/decision';
db.prepare(`SELECT ... FROM tickets WHERE ${CONDICION_DECISION_CONFIRMADA}`);
```

## Rutas (`rutas.ts`)

```ts
import { roleRequired } from './modules/auth/auth.middleware';
import { csrfProtection, csrfTokenProtection } from './modules/auth/csrf';
import { crearRutasTriaje } from './modules/triaje/rutas';
app.use('/api', csrfProtection, crearRutasTriaje({
  requiereRol: roleRequired,
  protegerEscrituras: csrfTokenProtection,
}));
```

`sessionMiddleware` se monta una sola vez en `app.ts`, antes de AUTH y Triaje.
Las rutas de Triaje utilizan el guard real de AUTH y leen la identidad del usuario
desde `req.session.userId`; nunca aceptan encabezados de identidad.

| Método y ruta | Roles | Respuestas |
|---|---|---|
| `GET /api/triaje/catalogos` | agente, administrador | 200 categorías, grupos y técnicos activos de SQLite · 401 · 403 |
| `POST /api/triaje/sugerir` | agente, administrador | 200 `SugerenciaTriaje` · 400 datos inválidos · 401 · 403 |
| `GET /api/tickets/:id/decision` | agente, administrador, técnico asignado | 200 sugerencia/decisión · 401 · 403 · 404 |
| `POST /api/tickets/:id/decision` | agente, administrador | 201 resultado · 400 · 401 · 403 · 404 · 409 ya decidido |

Las escrituras de Triaje requieren origen confiable y token CSRF de sesión. El detalle
de decisiones no consulta catálogos al rol técnico, que no está autorizado a leerlos.

La pantalla `/triaje` permite pedir una sugerencia a la API sin guardar un ticket.
La decisión solo se registra para un ticket ya persistido; la pantalla de demo no
crea tickets ni llama al endpoint de decisiones.

## Pruebas

`npm run check` compila backend/frontend y ejecuta la suite Vitest con SQLite en memoria, incluidos clasificador, matriz, asignación, decisión, rutas con sesión/CSRF e integración de ticket, historial y roles.
