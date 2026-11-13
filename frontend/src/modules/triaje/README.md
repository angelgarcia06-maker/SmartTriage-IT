# Módulo triaje
Propiedad del integrante asignado. Implementar componentes React sin editar `frontend/src/app/App.tsx` directamente; coordinar integración.

## `PanelSugerencia` (TRI-04)

Muestra la sugerencia original frente a la decisión final, con botones **Aceptar** y **Corregir** (categoría, prioridad, grupo y técnico). Al cambiar de grupo, el técnico se limpia si no pertenece al nuevo grupo y la lista solo muestra técnicos de ese grupo. Los campos corregidos se resaltan.

```tsx
import { PanelSugerencia } from '../triaje/PanelSugerencia';

<PanelSugerencia
  ticketId={ticket.id}
  sugerencia={sugerencia}               // SugerenciaTriaje
  catalogos={{ categorias, grupos, tecnicos }}
  onDecision={(r) => recargarTicket()}
/>
```

En la vista de demostración se mantiene el panel completo con `ticketId={null}`:
permite explorar las correcciones y sus resaltados, pero deshabilita aceptar o
guardar sin un ticket persistido. Desde el detalle de un ticket real (TICK-02),
pásale su `ticketId` y catálogos obtenidos de `GET /api/triaje/catalogos`.

## `api.ts`

- `pedirSugerencia(datosTicket)` → `POST /api/triaje/sugerir` (formulario de TICK-01).
- `obtenerCatalogos()` → `GET /api/triaje/catalogos` (agente/administrador; SQLite).
- `enviarDecision(ticketId, decision)` → `POST /api/tickets/:id/decision`.
