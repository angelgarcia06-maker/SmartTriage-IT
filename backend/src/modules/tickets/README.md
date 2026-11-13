# Tickets — Integrante 2

## TICK-01: registro

- `crearRutasTickets({ requiereAutenticacion, sugerir })` expone `POST /api/tickets`.
- El middleware de Auth debe dejar el usuario de sesión en `res.locals.usuario`.
- El sugeridor de Triaje es opcional; al conectarlo, se persiste su resultado en las columnas existentes del ticket. Tickets no implementa clasificación.
- La ruta devuelve `201 { id }`, valida únicamente solicitante, título, descripción, impacto y urgencia, y deniega el acceso si no se inyecta autenticación.
- `crearTicket` inserta el estado `Nuevo`; SQLite aplica el valor por defecto de `fecha_creacion`.

El integrador debe montar este router en `/api/tickets` junto con los middlewares reales de Auth y Triaje.

## TICK-02: listado y detalle

- `GET /api/tickets` devuelve `{ tickets }` ordenados por fecha descendente con ID, título, estado, categoría/prioridad sugeridas, técnico y fecha.
- `GET /api/tickets/:id` devuelve esos datos y los campos básicos del ticket; responde 404 para IDs inexistentes o tickets no asignados al técnico solicitante.
- Agentes y administradores pueden consultar todos los tickets. Técnicos solo reciben tickets cuyo `tecnico_id` coincide con su ID de sesión.
- La identidad y el rol provienen de `res.locals.usuario`, establecido por el middleware de Auth inyectado.

## TICK-03: filtros y búsqueda

- `GET /api/tickets` acepta `busqueda`, `estado`, `categoria_id`, `prioridad` y `tecnico_id`; todos son opcionales y combinables.
- `busqueda` compara el ID exacto y términos parciales en título y solicitante. El resto de criterios filtran por igualdad.
- Zod valida enums e IDs antes de consultar; todos los valores se enlazan como parámetros SQL.
- Para técnicos, el `tecnico_id` de sesión se combina siempre con el filtro solicitado, por lo que un query param no amplía su visibilidad.
