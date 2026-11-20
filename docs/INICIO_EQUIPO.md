# SmartTriage IT — Guía de inicio del equipo

**Repositorio oficial de trabajo:** https://github.com/angelgarcia06-maker/SmartTriage-IT

> Existe otro repositorio con el mismo nombre en `amena-otto`. Para el trabajo de los Issues #1–#26 usar **angelgarcia06-maker**. No confundir con TI SmartDesk AI.

## 1. Preparación (Windows/PowerShell)
Instala Node.js 24 y Git. Instala las dependencias una vez desde la raíz del repositorio.

```powershell
git clone https://github.com/angelgarcia06-maker/SmartTriage-IT.git
cd SmartTriage-IT
npm ci --ignore-scripts
```

Cuando termine la instalación, ejecuta `npm run dev:demo` y abre [SmartTriage IT](http://127.0.0.1:5173). El arranque prepara la base aislada con 40 tickets. Para volver a abrir la demo, ejecuta `npm run dev:demo`.

Para validar cambios de código, ejecuta `npm run check`. Para preparar una base de trabajo aparte, sigue los pasos del [README](../README.md#desarrollo-con-la-base-de-trabajo).

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
