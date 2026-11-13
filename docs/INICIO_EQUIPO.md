# SmartTriage IT — Guía de inicio del equipo

**Repositorio oficial de trabajo:** https://github.com/angelgarcia06-maker/SmartTriage-IT

> Existe otro repositorio con el mismo nombre en `amena-otto`. Para el trabajo de los Issues #1–#26 usar **angelgarcia06-maker**. No confundir con TI SmartDesk AI.

## 1. Preparación (Windows/PowerShell)
Instala Node.js 24, Git y VS Code. Para compilar `better-sqlite3` en Windows podría requerirse Visual Studio C++ Build Tools.

```powershell
git clone https://github.com/angelgarcia06-maker/SmartTriage-IT.git
cd SmartTriage-IT
node -v
npm -v
npm ci
npm run db:init
npm run db:seed
npm run check
npm run dev
```

Visita http://localhost:5173 (React) y http://localhost:3000/api/health (Express). Si `npm ci` falla por el lockfile o por SQLite, envía el error exacto al integrador; no alteres dependencias de forma individual.

**Cuentas solo de demo:** `admin`, `agente`, `tecnico1`–`tecnico4`; contraseña temporal `Cambiar123!` (según README actual). No utilizar en producción.

## 2. Flujo Git obligatorio
Cada rama existe previamente. Consulta la tuya en [RESPONSABILIDADES.md](RESPONSABILIDADES.md).

```powershell
git fetch origin
git switch feature/MI-RAMA
git pull --ff-only origin feature/MI-RAMA
git status
```

Cambia únicamente archivos de tu módulo. Ejecuta `npm run check` y **reporta su resultado real**, aunque falle. Commits y push:

```powershell
git add frontend/src/modules/MI-MODULO backend/src/modules/MI-MODULO
git commit -m "feat(modulo): implementar funcionalidad"
git push -u origin feature/MI-RAMA
```

Adapta `git add` a los archivos realmente modificados; no hagas un `git add .` sin comprobarlo. Abre un PR hacia `main` y enlaza tu Issue (`Closes #NUMERO`). **No fusiones tu propio PR.**

## 3. Cómo avanzar sin esperar a otros
- Implementa primero tu parte con **mocks/stubs tipados** que respeten el contrato común.
- No dupliques lógica de otro módulo para resolver una dependencia.
- No cambies `shared/`, `backend/src/db/schema.sql`, `seed.ts`, la configuración raíz ni dependencias sin acordarlo con el integrador.
- Comunica cualquier cambio necesario en contratos antes de implementarlo.

## 4. Cuándo se considera una tarea terminada
- Cumple la checklist del Issue.
- Tiene pruebas relevantes y `npm run check` verificado.
- Incluye captura o ejemplo de API.
- Se entrega mediante PR a `main`, solicitando revisión del Integrante 5.

## 5. Cómo reportar problemas
Incluye Issue, rama, comando ejecutado, error completo, salida de `node -v` y `git status`. No envíes solo 'no funciona'. Nunca compartas tokens, archivos `.env` ni datos privados.

**Estado de partida:** el repositorio contiene el esqueleto React/Express/SQLite y contratos, pero no necesariamente las funcionalidades del MVP. No asumir que la aplicación está terminada porque el entorno arranca.
