# SmartTriage IT — Plan de pruebas e integración (QA-02 / QA-03)

Estado: **casos diseñados, aún no ejecutados**. Nunca marcar PASA sin evidencia de ejecución.

## Alcance
- QA-01: instalación limpia, base SQLite, API /health y contratos.
- QA-02: corpus de clasificación, matriz de prioridad, asignación y validaciones.
- QA-03: sesión → ticket → sugerencia → persistencia → listado.
- Versión inicial del triaje: reglas configurables, **no machine learning entrenado**.

## Ambiente reproducible
Windows 10/11, Node.js 24, npm, repo `angelgarcia06-maker/SmartTriage-IT`, base de prueba local con seed, perfiles agente/administrador/técnico. No usar datos reales. Ejecutar `npm ci`, `npm run db:init`, `npm run db:seed`, `npm run check`, `npm run dev` y guardar logs.

## Criterios de entrada
- La rama bajo prueba está identificada (commit SHA).
- Los módulos dependientes están integrados o se declara que se usan fixtures.
- El proyecto arranca y `/api/health` responde con base conectada.

## Criterios de salida
- No hay defectos críticos/altos abiertos en el flujo MVP.
- `npm run check` pasa sin modificar dependencias durante la ejecución.
- QA-02 aporta pruebas deterministas, QA-03 demuestra persistencia tras recarga.
- Evidencia: captura, salida del comando y SHA de commit para cada ejecución.

## Matriz manual de pruebas
| ID | Módulo | Entrada / acción | Resultado esperado | Estado |
|---|---|---|---|---|
| INS-01 | Instalación | `npm ci` en clon limpio | Instala sin cambios manuales | NO EJECUTADO |
| INS-02 | SQLite | db:init y db:seed dos veces | Idempotente, sin duplicados | NO EJECUTADO |
| INS-03 | API | GET /api/health | 200 con DB conectada | NO EJECUTADO |
| TRI-01 | Clasificador | `No me conecta el wifi` | Red, activadora wifi | NO EJECUTADO |
| TRI-02 | Clasificador | `El teclado no escribe` | Hardware, activadora teclado | NO EJECUTADO |
| TRI-03 | Clasificador | `Olvidé mi contraseña` | Accesos | NO EJECUTADO |
| TRI-04 | Clasificador | `No abre la aplicación` | Software | NO EJECUTADO |
| TRI-05 | Clasificador | `No abre outlook` | Correo | NO EJECUTADO |
| TRI-06 | Clasificador | `La cafetera hace ruido` | Otros, activadora null | NO EJECUTADO |
| TRI-07 | Clasificador | `CONEXION` | Red aunque falte tilde | NO EJECUTADO |
| TRI-08 | Clasificador | `emailing` | No debe coincidir con email | NO EJECUTADO |
| TRI-09 | Clasificador | Nuevo término `vpn` insertado en DB | Clasificación cambia sin recompilar | NO EJECUTADO |
| TRI-10 | Clasificador | Desactivar categoría Red | Ya no se clasifica como Red | NO EJECUTADO |
| TRI-11 | Clasificador | Frases empatadas | Resultado repetible | NO EJECUTADO |
| TRI-12 | Clasificador | Texto vacío | Otros (el formulario debe validar previamente) | NO EJECUTADO |
| PRI-01 | Prioridad | Alto / Alta | Crítica | NO EJECUTADO |
| PRI-02 | Prioridad | Alto / Media | Alta | NO EJECUTADO |
| PRI-03 | Prioridad | Alto / Baja | Media | NO EJECUTADO |
| PRI-04 | Prioridad | Medio / Alta | Alta | NO EJECUTADO |
| PRI-05 | Prioridad | Medio / Media | Media | NO EJECUTADO |
| PRI-06 | Prioridad | Medio / Baja | Baja | NO EJECUTADO |
| PRI-07 | Prioridad | Bajo / Alta | Media | NO EJECUTADO |
| PRI-08 | Prioridad | Bajo / Media | Baja | NO EJECUTADO |
| PRI-09 | Prioridad | Bajo / Baja | Baja | NO EJECUTADO |
| ASG-01 | Asignación | Dos técnicos activos en mismo grupo | Elegir menor carga de abiertos | NO EJECUTADO |
| ASG-02 | Asignación | Empate de carga | Elegir menor ID | NO EJECUTADO |
| ASG-03 | Asignación | Grupo sin técnico disponible | tecnico_id = null | NO EJECUTADO |
| AUT-01 | Auth | Sin sesión GET de recurso protegido | 401 | NO EJECUTADO |
| AUT-02 | Auth | Rol técnico invoca operación de admin | 403 | NO EJECUTADO |
| AUT-03 | Auth | Credenciales inválidas | Sin sesión creada | NO EJECUTADO |
| TIC-01 | Tickets | Agente crea ticket válido | Persistencia e ID generado | NO EJECUTADO |
| TIC-02 | Tickets | Faltan campos obligatorios | 400, sin insert | NO EJECUTADO |
| TIC-03 | Tickets | Recargar listado | Ticket visible y estado Nuevo | NO EJECUTADO |
| E2E-01 | Integral | Login → crear → sugerencia → guardar → listar | Flujo completo sin mocks en integración | NO EJECUTADO |
| E2E-02 | Integral | Reiniciar API y abrir listado | Se conserva el ticket | NO EJECUTADO |
| DEC-01 | Decisiones | Aceptar sugerencia | Guarda final, sin correcciones | NO EJECUTADO |
| DEC-02 | Decisiones | Modificar categoría/prioridad | Conserva sugerido y registra diferencias | NO EJECUTADO |
| DEC-03 | Decisiones | Repetir decisión | 409, sin duplicados | NO EJECUTADO |
| MET-01 | Métricas | Ticket sin decisión | No se cuenta como aceptado | NO EJECUTADO |

**Nota:** la matriz 3×3 es la propuesta documentada en el módulo Triaje; el equipo debe confirmar su aprobación antes de fijarla como criterio contractual.

## Evidencia automatizada de auditoría

- `npm run check` — PASA: compilación backend/frontend y 194 pruebas en 20 archivos, incluidas migración, autorización, CSRF, asignación, estados, decisiones e historial.
- `npm run db:seed:demo` — PASA: seed validado sin modificar registros; 40 tickets (8 Nuevo, 8 Asignado, 10 En proceso, 9 Resuelto, 5 Cerrado), 25 decisiones aceptadas, 10 corregidas y 5 pendientes; 110 eventos de historial; `integrity_check: ok`.
- `git diff --check` — PASA.
- Validación runtime standalone — PASA: 5/5 aserciones; `npm run dev:demo` sirvió frontend y `/api/health` respondió HTTP 200.

La suite automatizada no reemplaza los pasos de instalación limpia (`npm ci`),
verificación de persistencia después de reiniciar la API ni recorrido visual con
captura; esos casos manuales siguen pendientes de ejecución.

## Reporte por ejecución
Fecha | Rama | SHA | Node | SO | Comando | Resultado | Evidencia | Responsable.

## Defectos
Para cada fallo abrir Issue con prefijo `[BUG]`, pasos para reproducir, esperado, observado, captura/log, severidad, versión y asignado. No alterar tests solo para que pasen.
