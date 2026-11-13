# Ejecución manual, sin cambiar configuraciones, desde la raíz del repositorio
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'package.json') -or -not (Test-Path 'backend/src/db/schema.sql')) {
    throw 'Ejecuta este script desde la carpeta raíz de SmartTriage-IT.'
}
Write-Host '=== SMARTTRIAGE QA: DIAGNOSTICO ==='
Write-Host 'Repositorio:' (Get-Location).Path
node --version
npm --version
git remote -v
git branch --show-current
git status --short
Write-Host '=== Dependencias ==='
if (Test-Path 'node_modules') { Write-Host 'node_modules existente' } else { Write-Host 'node_modules ausente' }
Write-Host '=== Pruebas actuales (NO instala ni modifica dependencias) ==='
npm run check
if ($LASTEXITCODE -ne 0) { throw 'npm run check falló; guarda la salida para el Issue de QA.' }
Write-Host '=== OK: compilación y tests del estado actual ==='
Write-Host 'Para revisar instalación limpia, hacer una prueba separada en un clon descartable; no borres node_modules ni SQLite de trabajo.'
