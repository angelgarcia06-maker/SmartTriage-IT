@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js.
  echo Instala Node.js 24 LTS desde https://nodejs.org/ y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm. Reinstala Node.js 24 LTS y vuelve a intentarlo.
  pause
  exit /b 1
)

if not exist "node_modules\tsx\package.json" (
  echo Preparando la aplicacion. Esta instalacion solo se realiza la primera vez.
  call npm ci --ignore-scripts
  if errorlevel 1 (
    echo.
    echo No se pudieron instalar las dependencias. Revisa el error anterior.
    pause
    exit /b 1
  )
)

echo Iniciando SmartTriage IT con los datos de demostracion...
call npm run dev:demo
if errorlevel 1 (
  echo.
  echo La aplicacion no pudo iniciar. Revisa el error anterior.
  pause
  exit /b 1
)
