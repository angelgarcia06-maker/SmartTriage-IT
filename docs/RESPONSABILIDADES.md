# Responsabilidades y distribución de trabajo

Los responsables de esta tabla están contrastados con los **assignees de Issues de GitHub** al 12/11/2026. Si el texto de un Issue menciona un número de integrante discordante, prevalece el usuario asignado y la rama.

| Responsable / usuario de GitHub | Área | Rama ya creada | Issues |
|---|---|---|---|
| Renzo / `renzooo194-tech` | Login, sesión, usuarios y roles | `feature/auth-usuarios` | AUTH-01 a AUTH-06 (#6–#11) |
| Asmad / `gasmad70-a11y` | Tickets: registro, listado, filtros y estados | `feature/tickets` | TICK-01 a TICK-05 (#17–#21) |
| Máximo / `Maximo-13` | Reglas de triaje y sugerencias | `feature/triaje` | TRI-01 a TRI-05 (#22–#26) |
| Hurtado / `hurtadosilvajoel-spec` | Categorías, grupos y métricas admin | `feature/panel-admin` | ADM-01 a ADM-05 (#1–#5) |
| Integrador / `angelgarcia06-maker` | Contratos, pruebas, documentación e integración | `feature/pruebas-docs` | QA-01 a QA-05 (#12–#16) |

## Funcionalidad MVP mínima
1. **Renzo:** login/logout funcional, sesión y permisos protegidos por backend.
2. **Asmad:** formulario de ticket con solicitante, título, descripción, impacto y urgencia; guardar y listar.
3. **Máximo:** detección por palabras clave, matriz impacto/urgencia y sugerencia de grupo/técnico explicada.
4. **Hurtado:** categorías y grupos consultables, datos editables en segunda etapa.
5. **Integrador:** validar extremo a extremo: login → crear ticket → ver sugerencia → guardar → consultar.

## Segunda etapa
- AUTH-04..06: CRUD de usuarios, endurecimiento de sesiones, pruebas.
- TICK-03..05: búsqueda, historial y cierre, pruebas.
- TRI-04..05: aceptar/corregir sugerencia, historial y pruebas.
- ADM-02..05: gestión de categorías/grupos/palabras y métricas.
- QA-04..05: integración completa y demo.

## Rutas de propiedad (no invadir otras)
- AUTH: `frontend/src/modules/auth/`, `backend/src/modules/auth/`.
- TICK: `frontend/src/modules/tickets/`, `backend/src/modules/tickets/`.
- TRI: `frontend/src/modules/triaje/`, `backend/src/modules/triaje/`.
- ADM: `frontend/src/modules/admin/`, `backend/src/modules/admin/`.
- QA: `shared/`, `docs/`, integración y configuración general coordinada.

**Nota de calendario:** el README anterior menciona la entrega del 12/11; si esa fecha ya se cumple, no asumir prórroga. Priorizar PRs pequeños integrables y acordar cualquier nuevo hito en equipo.
