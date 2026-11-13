# Módulo tickets

## TICK-01: registro

- `TicketCreateForm` presenta los cinco campos requeridos y envía el alta a `POST /api/tickets`.
- Al crearse, muestra el identificador devuelto por la API; los errores del servidor se muestran junto al formulario.

## TICK-02: listado y detalle

- `TicketsPage` coordina localmente listado, alta y detalle; usa `GET /api/tickets` y `GET /api/tickets/:id`.
- El listado presenta los datos requeridos y el detalle incluye descripción, solicitante, impacto y urgencia.
- El Integrante 5 debe montar `TicketsPage` en la navegación global; este módulo no edita `App.tsx`.
