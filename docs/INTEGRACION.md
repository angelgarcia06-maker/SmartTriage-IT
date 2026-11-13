# Arquitectura, contratos y reglas de integración

## Stack establecido (no cambiar)
React 19 + TypeScript + Vite, Node.js + Express 5 + TypeScript, SQLite con `better-sqlite3`, monorepo npm workspaces. Triaje Nivel 1 mediante diccionario de palabras clave y reglas deterministas; **no** presentar como ML entrenado.

## Datos y restricciones del esquema actual
Fuente de verdad: `backend/src/db/schema.sql` y contratos del directorio `shared/`.

- `usuarios`: id, nombre, usuario, `password_hash`, rol (`agente`, `tecnico`, `administrador`), activo, grupo_id.
- `grupos`: id, nombre, activo.
- `categorias`: id, nombre, grupo_id, activa.
- `palabras_clave`: id, categoria_id, palabra.
- `tickets`: solicitante, titulo, descripcion, impacto (`Alto|Medio|Bajo`), urgencia (`Alta|Media|Baja`), estado (`Nuevo|Asignado|En proceso|Resuelto|Cerrado`), fecha, creado_por, tecnico_id, categoría/prioridad/grupo sugeridos y finales, palabra_activadora, aceptada_sin_correccion, fecha_decision.
- `historial` y `correcciones`: auditoría sin sobrescribir valores originales.

**No inventar nombres de endpoints ni modificar enumeraciones:** revisar antes los archivos de `shared/contracts/` y los Issues del módulo.

## Acuerdos por módulo

### AUTH
- Autenticar contra usuarios existentes con hash de contraseña; sesión persistente según diseño actual del repositorio.
- Proteger operaciones desde Express, además de React; retorno de usuario sin hash.
- Los demás módulos deben consumir un único contexto de sesión, no fabricar autenticación paralela.

### TICKETS
- Guardar solicitante, título, descripción, impacto y urgencia, vinculando `creado_por` a la sesión.
- Al mostrar sugerencias, invocar el servicio de Triaje; no implementar otro clasificador en Tickets.
- Mantener el detalle y listado fieles a los datos persistidos.

### TRIAJE
- Determinar categoría según reglas/palabras clave existentes, prioridad según matriz, grupo según categoría y técnico elegible de menor carga.
- Si no hay categoría o técnico, usar respuesta explícita y `null` donde corresponda, nunca una entidad inventada.
- Misma entrada + mismo catálogo = mismo resultado; incluir explicación/palabra activadora.
- Guardar sugerencia inicial y correcciones sin destruir la trazabilidad cuando se integre TRI-04.

### ADMIN
- Administrar catálogo único de grupos, categorías y palabras clave, sin replicar motor de triaje.
- La aceptación se mide sobre tickets con decisión confirmada; excluir indecisos del denominador.

### QA / INTEGRACIÓN
- Verificar que todos los módulos compartan contratos y roles reales del esquema.
- Revisar las PR, integrar en orden y evitar cambios simultáneos a archivos globales.
- Mantener datos de demostración reproducibles, sin subir bases locales al repositorio.

## Orden de integración sugerido
1. QA-01 esquema/contratos y ADM-01 catálogo.
2. AUTH-01..03 sesión y autorización.
3. TRI-01..03 reglas y sugerencia con fixture.
4. TICK-01..02 flujo principal, integrando Triaje.
5. QA-02/03 pruebas end-to-end; luego segunda fase.

## Pruebas mínimas a verificar
- Sin sesión: operación protegida rechazada.
- Rol equivocado: rechazo desde backend.
- Campos obligatorios vacíos y valores inválidos: no se guardan.
- Igual impacto/urgencia produce igual prioridad.
- Sin palabra coincidente: clasificación explicada sin inventar resultados.
- Sin técnico disponible: `null`.
- Al registrar ticket, aparece tras refrescar el listado.
- Se guarda sugerencia original aunque el agente la modifique.
- Evitar duplicar correcciones/decisiones por doble envío.
- `npm run check` se ejecuta y el PR indica si pasó o falló.

## Política de integración
Cada PR modifica preferentemente un solo módulo y debe ser revisado por QA. No hacer force push a `main`, no fusionar con checks fallidos, no subir secrets `.env`, `*.db`, `node_modules`, `dist` ni datos personales.
