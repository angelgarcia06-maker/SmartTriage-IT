
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

### Integración

Las consultas de catálogos requieren sesión AUTH y están disponibles para
cualquier usuario autenticado que necesite cargar los datos. El CRUD requiere
rol administrador y protección CSRF. El panel está montado en
`/admin/catalogos`.

---

## ADM-02: CRUD de categorías y grupos

### Objetivo

Implementar la administración de categorías y grupos
de soporte técnico mediante operaciones de creación,
edición y desactivación.

### Funcionalidades implementadas

Grupos:
- Registrar nuevos grupos.
- Editar nombres de grupos activos.
- Desactivar grupos sin eliminar registros.
- Evitar nombres duplicados.
- Impedir desactivar grupos con categorías activas.

Categorías:
- Registrar nuevas categorías.
- Editar nombres y grupos responsables.
- Asignar únicamente grupos activos.
- Evitar categorías duplicadas.
- Desactivar categorías sin eliminar registros.

### Seguridad

Las operaciones administrativas están conectadas a `loginRequired` y
`roleRequired('administrador')`. Las escrituras también pasan por
`csrfProtection`; sin configurar esos middlewares, el router falla cerrado.

### Frontend

Se amplió CatalogosPanel.tsx con:
- Formulario de categorías.
- Formulario de grupos.
- Botones para editar.
- Botones para desactivar.
- Mensajes de confirmación y errores.

### Pruebas

- 13 pruebas nuevas de ADM-02 aprobadas.
- 79 pruebas totales del proyecto aprobadas.
- Compilación del frontend correcta.
- Compilación del backend correcta.

El panel original está montado en `/admin/catalogos`; el menú y la ruta están
restringidos a administradores.

---

## ADM-03: Diccionario editable y probar frase

### Objetivo

Permitir que el administrador gestione palabras clave
asociadas a categorías y pruebe la clasificación de
incidencias utilizando el motor de Triaje existente.

### Funcionalidades implementadas

- Consultar palabras clave por categoría.
- Agregar nuevas palabras.
- Editar palabras y sus categorías.
- Quitar palabras del diccionario.
- Evitar duplicados mediante normalización.
- Validar categorías activas.
- Probar frases utilizando el clasificador existente.

### Prueba del clasificador

Frase: "Mi proyector no enciende"

1. Sin la palabra "proyector": categoría Otros.
2. Al agregar "proyector" a Hardware: categoría Hardware.
3. Al quitar "proyector": categoría Otros.

El cambio se refleja sin reiniciar el servidor.

### Archivos desarrollados

Backend:
- diccionario.routes.ts
- diccionario.routes.test.ts

Frontend:
- diccionario.api.ts
- DiccionarioPanel.tsx

### Resultados de pruebas

- 13 pruebas nuevas de ADM-03 aprobadas.
- 92 pruebas totales aprobadas.
- Compilación del backend correcta.
- Compilación del frontend correcta.
- Verificados duplicados, permisos simulados,
  edición, eliminación y actualización de clasificación.

El router está montado bajo `/api/admin` y exige sesión y rol administrador.
El clasificador existente consulta las palabras en SQLite en cada llamada, por
lo que los cambios del diccionario se reflejan sin reiniciar el servidor. El
panel original está disponible en `/admin/diccionario`.

---

## ADM-04: Dashboard y precisión

### Objetivo

Implementar un Dashboard administrativo para consultar
estadísticas de tickets y medir la precisión de las
sugerencias del sistema SmartTriage-IT.

### Funcionalidades implementadas

- Conteo total de tickets.
- Tickets agrupados por estado.
- Tickets agrupados por categoría.
- Tickets agrupados por prioridad.
- Porcentaje de aceptación global.
- Precisión por categoría, prioridad, grupo y técnico.
- Precisión por categoría sugerida originalmente.
- Manejo de casos sin decisiones confirmadas.

### Cálculo de aceptación global

Fórmula:

Aceptación (%) =
(Decisiones aceptadas sin corrección /
Total de decisiones confirmadas) * 100

Caso de prueba:

- Decisiones confirmadas: 10
- Aceptadas sin corrección: 8
- Aceptación global: 80%

Los tickets sin decisión no participan
en el denominador.

### Archivos implementados

Backend:
- metricas.service.ts
- metricas.service.test.ts
- metricas.routes.ts
- metricas.routes.test.ts

Frontend:
- metricas.api.ts
- DashboardPanel.tsx

### Pruebas realizadas

- 7 pruebas nuevas de ADM-04 aprobadas.
- 99 pruebas totales aprobadas.
- Compilación del frontend correcta.
- Compilación del backend correcta.
- Verificado cálculo de aceptación del 80%.
- Verificados casos sin decisiones.
- Verificados accesos HTTP 200, 401 y 403
  mediante middlewares simulados.

El endpoint `GET /api/admin/metricas` y el panel original `/admin/dashboard`
requieren rol administrador. Los conteos consultan SQLite y la precisión
considera únicamente decisiones confirmadas.

## Integración y validación

`backend/src/app.ts` monta una sola vez cada router ADM, con sesión AUTH
compartida y protección CSRF para las rutas de escritura. Las pruebas reales de
integración con AUTH están en `admin.integration.test.ts`; Vitest ejecuta cada
archivo con `DB_FILE=':memory:'`, sin modificar la base de trabajo.
