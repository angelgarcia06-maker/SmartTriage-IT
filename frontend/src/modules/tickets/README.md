# Módulo tickets

## TICK-01: registro

- `TicketCreateForm` presenta los cinco campos requeridos y envía el alta a `POST /api/tickets`.
- Al crearse, muestra el identificador devuelto por la API; los errores del servidor se muestran junto al formulario.
- Integrar el componente desde la aplicación sin editar `App.tsx` en este módulo.
