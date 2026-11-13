# Módulo tickets

## TICK-01: registro

- `TicketCreateForm` presenta los cinco campos requeridos y envía el alta a `POST /api/tickets`.
- Al crearse, muestra el identificador y el `PanelSugerencia` original para aceptar o corregir la recomendación persistida; las escrituras envían el token CSRF de AUTH-05.

## TICK-02: listado y detalle

- `TicketsPage` coordina localmente listado, alta y detalle; usa `GET /api/tickets` y `GET /api/tickets/:id`.
- El listado presenta los datos requeridos y el detalle incluye descripción, solicitante, impacto y urgencia.
- `TicketsPage` está disponible en `/tickets`; el menú y las acciones se limitan según el rol.

## TICK-03: filtros y búsqueda

- El listado permite combinar búsqueda por ID, título o solicitante con estado, categoría sugerida, prioridad y técnico.
- Los filtros se envían a `GET /api/tickets` y el estado vacío distingue entre lista vacía y búsqueda sin coincidencias.

## TICK-04: estados e historial

- El detalle permite avanzar por las transiciones válidas y reabrir un ticket resuelto con motivo.
- La cronología muestra acción, autor, fecha y estados anterior/nuevo sin editar eventos existentes.

## TICK-05: cierre

- El detalle informa que `Cerrado` es terminal y no presenta acciones de cambio de estado posteriores.
