# SmartTriage IT
Prototipo académico de mesa de ayuda y triaje de incidentes. **No es TI SmartDesk AI institucional.**

## Requisitos
Node.js 22.12+ o 24 LTS, npm, Git. Para menor fricción use Node 24 LTS.

## Demo para la entrega
Desde la raíz del repositorio en la rama `main`, instala las dependencias la primera vez:

```powershell
npm ci
```

Para abrir la demo, ejecuta:

```powershell
npm run dev:demo
```

Abre [SmartTriage IT](http://127.0.0.1:5173). Si los puertos 5173 o 3000 están ocupados, detén la otra instancia de SmartTriage antes de arrancar la demo.

| Usuario | Qué puedes revisar |
| --- | --- |
| `admin` | Panel de métricas, catálogos y diccionario |
| `agente` | Bandeja de tickets, registro y sugerencias de triaje |
| `tecnico1` a `tecnico4` | Tickets asignados a cada técnico |

La contraseña de todas las cuentas de demo es `Cambiar123!`. Usa estas cuentas en la demo local.

El primer arranque genera `data/demo/smarttriage-demo.db` con 40 tickets ficticios, historial y decisiones de triaje. Los siguientes arranques reutilizan esa base, aplican las migraciones pendientes y conservan tus cambios. Cada integrante tiene su propia copia local. La base de trabajo `data/smarttriage.db` queda aislada.

## Desarrollo con la base de trabajo

`npm run dev` sigue usando `DB_FILE` o `data/smarttriage.db`. Para preparar una base de trabajo nueva, usa `npm run db:init` y `npm run db:seed` antes de arrancar. Las escrituras de Tickets requieren sesión y token CSRF de AUTH-05.

## Estructura
- `frontend/src/modules/`: auth / tickets / triaje / admin.
- `backend/src/modules/`: mismos módulos API.
- `shared/types/`, `shared/contracts/`: contratos fijados por integrador.
- `backend/src/db/`: esquema y seed reproducibles.
- `docs/`: arquitectura, GitHub y cronograma.
- `issues/`: 25 plantillas copiables para GitHub.

## Comprobación
```powershell
npm run check
```
En la primera entrega del **jueves 12/11/2026**, se debe demostrar login → registro de ticket → sugerencia explicada → guardado → listado. El repositorio base por sí solo **no constituye esa entrega**.

## Colaboración
Cada persona trabaja en su propia rama y abre un PR hacia `main`. El Integrante 5 revisa y fusiona. `data/*.db` y secretos nunca se suben.
