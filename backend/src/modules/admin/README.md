
# Módulo de Administración — SmartTriage IT

## ADM-01: Catálogos iniciales y grupos

Responsable: Integrante 4
Rama: feature/panel-admin

### Objetivo

Permitir la consulta de categorías y grupos de soporte técnico
almacenados en SQLite, para utilizarlos en los módulos
de Tickets y Triaje.

### Endpoints implementados

GET /api/catalogos/categorias

- Devuelve categorías activas.
- Incluye el ID y nombre del grupo responsable.
- Consulta los registros de SQLite.

GET /api/catalogos/grupos

- Devuelve los grupos activos.
- Consulta los registros de SQLite.

### Categorías y grupos

| Categoría | Grupo responsable |
|---|---|
| Hardware | Soporte general |
| Software | Aplicaciones |
| Red | Redes y conectividad |
| Accesos | Identidades y correo |
| Correo | Identidades y correo |
| Otros | Soporte general |

### Archivos desarrollados

Backend:
- catalogos.routes.ts
- catalogos.routes.test.ts
- catalogos.smoke.ts

Frontend:
- catalogos.api.ts
- CatalogosPanel.tsx

### Pruebas realizadas

- Compilación de backend y frontend correcta.
- 66 pruebas automáticas aprobadas.
- GET categorías: HTTP 200, seis categorías.
- GET grupos: HTTP 200, cuatro grupos.
- Consultas verificadas con SQLite real.

### Integración pendiente

- Registrar catalogosRouter en backend/src/app.ts.
- Incorporar CatalogosPanel a la aplicación React.
- Verificar las peticiones desde el navegador.

La integración de archivos compartidos corresponde
al integrante encargado de integración.
