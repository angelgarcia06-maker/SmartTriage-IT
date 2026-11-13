# SmartTriage IT
Prototipo académico de mesa de ayuda y triaje de incidentes. **No es TI SmartDesk AI institucional.**

## Requisitos
Node.js 22.12+ o 24 LTS, npm, Git. Para menor fricción use Node 24 LTS.

## Iniciar en Windows / PowerShell
```powershell
npm install
npm run db:init
npm run db:seed
npm run dev
```
- Frontend: http://localhost:5173
- API health: http://localhost:3000/api/health
- Datos de demostración: `admin`, `agente`, `tecnico1`–`tecnico4` / clave temporal `Cambiar123!` (**solo desarrollo**, cambiar antes de uso real).

La aplicación incluye autenticación por sesión, triaje, tickets e interfaces de administración. Las escrituras de Tickets requieren sesión y token CSRF de AUTH-05.
Los comandos convencionales `db:init` y `db:seed` usan `DB_FILE` o `data/smarttriage.db`; no los ejecutes sobre una base existente sin autorización explícita.

## Base de demostración aislada
`npm run db:seed:demo` crea `data/demo/smarttriage-demo.db`, una base separada de `data/smarttriage.db`, con 40 tickets de ejemplo, transiciones e historial, y decisiones registradas. El comando solo crea esa base si no existe; ante una base preexistente que no esté marcada como su propia salida, se detiene sin modificarla. Las ejecuciones posteriores validan y resumen el seed existente sin insertar ni actualizar registros.

Para iniciar la aplicación usando esa base en PowerShell:
```powershell
npm run db:seed:demo
$env:DB_FILE = (Join-Path $PWD 'data\demo\smarttriage-demo.db')
npm run dev
```
Para volver a la base predeterminada, elimina la variable con `Remove-Item Env:DB_FILE`. En la base de demostración se usan las cuentas `admin`, `agente`, `tecnico1`–`tecnico4` con clave temporal `Cambiar123!`; son solo para demostración local.

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
