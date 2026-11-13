# SmartTriage IT — Guía de integración del MVP (QA-03)

## Contratos estables
- DB: `backend/src/db/schema.sql`, fuente de verdad. Evitar cambios por módulo sin coordinación.
- Tipos: `shared/types/triaje.types.ts`.
- Auth: la sesión determina id/rol; jamás confiar en `creado_por` recibido del cliente.
- Triaje: clasificación basada en diccionario SQLite, prioridad por matriz impacto/urgencia, grupo de categoría y técnico elegible; **Otros** es la categoría de respaldo y debe conservarse.
- Tickets: guarda categoría/prioridad/grupo sugeridos (y los finales cuando se acepte o corrija), fecha/estado, y permite listar después de recargar.
- Conservar y mostrar la `explicacion` al agente: confirmar dónde vive el campo, porque `SugerenciaTriaje` en shared actualmente no lo declara.

## Secuencia de integración recomendada
1. QA-01: instalación, seed, contratos, validación API /health.
2. AUTH: montar rutas protegidas y asegurar cookies/sesión en cliente.
3. ADM-01: catálogos existentes visibles para agentes y motores.
4. TRI-01..03: función y endpoint de sugerencia; pruebas.
5. TICK-01..02: registro y listado con sugerencia y persistencia.
6. QA-03: recorrido real extremo a extremo; capturas y registro de fallos.
7. TRI-04, ADM-04, TICK-04: decisiones, métricas y estados (segunda etapa).

## Checklist de revisión por PR
- [ ] El PR referencia un Issue y no invade módulos ajenos.
- [ ] Archivos globales o contratos se modificaron con coordinación previa.
- [ ] No incluye base SQLite, secretos ni contenido generado.
- [ ] Los inputs se validan en backend.
- [ ] No expone `password_hash` ni datos sensibles.
- [ ] El módulo tiene pruebas y evidencia.
- [ ] `npm run check` ejecutado; anotar fallos y plataforma.
- [ ] No existen errores de importación/circularidad o rutas duplicadas.
- [ ] Las reglas de fallback son explícitas (Otros / null si no técnico).
- [ ] Se conserva el funcionamiento de módulos ya integrados.

## Plan de demo
1. Ingresar como agente.
2. Registrar incidencia «No me conecta el wifi», impacto Alto, urgencia Alta.
3. Comprobar sugerencia: Red, prioridad Crítica, grupo Redes y técnico asignable o null justificable.
4. Guardar ticket y abrir listado y detalle.
5. Recargar: comprobar que sigue guardado.
6. Si la función de corrección está integrada: mostrar aceptación/corrección e historial.

## Regla de calidad
No etiquetar `v0.1.0` ni declarar primer avance completo sin un recorrido E2E real validado. Mantener registro de decisiones y defectos.
