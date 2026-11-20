# Tickets — Integrante 2

`app.ts` monta este router en `/api/tickets` con la sesión de AUTH, comprobación de origen y token CSRF de AUTH-05 para POST/PATCH. La creación llama al sugeridor original de Triaje y devuelve la sugerencia persistida junto con el ID.

## TICK-01: registro

- `crearRutasTickets({ requiereAutenticacion, sugerir })` expone `POST /api/tickets`.
- El middleware de Auth debe dejar el usuario de sesión en `res.locals.usuario`.
- El sugeridor de Triaje se inyecta desde `app.ts`; su resultado original se persiste en las columnas existentes del ticket. Tickets no implementa clasificación.
- La ruta devuelve `201 { id, sugerencia }`, valida únicamente solicitante, título, descripción, impacto y urgencia, y deniega el acceso si no se inyecta autenticación.
- `crearTicket` inserta el estado `Nuevo`; SQLite aplica el valor por defecto de `fecha_creacion`.

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

## TICK-04: estados e historial

- `PATCH /api/tickets/:id/estado` permite `Nuevo → Asignado → En proceso → Resuelto → Cerrado` y `Resuelto → En proceso` con motivo obligatorio.
- Agentes y administradores pueden cambiar estados; técnicos solo pueden hacerlo en tickets asignados a su usuario.
- El cambio y el evento de historial se guardan en la misma transacción; las transiciones inválidas responden 409.
- `GET /api/tickets/:id/historial` devuelve los eventos de forma cronológica y respeta los mismos permisos de visibilidad.

## TICK-05: pruebas y cierre

- `Cerrado` es un estado terminal; cualquier transición posterior se rechaza con 409 y no agrega eventos al historial.
- `tickets.routes.test.ts` cubre el flujo de alta, consulta, filtros, cambios de estado, cierre y cronología con SQLite en memoria.
- También verifica que un fallo al insertar el historial revierte el cambio de estado.

## Seguimiento y asignación

- Agentes y administradores pueden asignar o reasignar un ticket a un técnico activo con `PATCH /api/tickets/:id/asignacion`; la operación registra técnico, grupo y cambio de estado en el historial.
- El técnico solo consulta sus tickets asignados. Puede iniciar la atención y marcar un ticket como resuelto después de registrar la solución aplicada.
- El cierre de tickets resueltos corresponde al agente o administrador. La solución queda guardada en `tickets.resolucion` y en el historial.
- La migración de `resolucion` es aditiva: bases que ya tienen tickets conservan sus datos y reciben la columna si todavía no existe.
