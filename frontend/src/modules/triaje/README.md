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

Para usarlo desde el detalle de ticket (TICK-02), pásale los catálogos de categorías, grupos y técnicos (Admin/Auth).

## `api.ts`

- `pedirSugerencia(datosTicket)` → `POST /api/triaje/sugerir` (formulario de TICK-01).
- `enviarDecision(ticketId, decision)` → `POST /api/tickets/:id/decision`.
