# Revisión preliminar PR #27 — TRI-01

URL: https://github.com/angelgarcia06-maker/SmartTriage-IT/pull/27
Revisor funcional: Integrante 5, QA.
Estado: **APTO CON VERIFICACIONES PENDIENTES; NO FUSIONAR HASTA COMPROBACIÓN**.

## Análisis estático
- `clasificador.ts`: consulta categorías activas y palabras desde SQLite, fallback `Otros`, resultado explicable, desempate determinista. No introduce SQL concatenado con datos de usuario.
- `normalizar.ts`: NFD, elimina diacríticos, puntuación como separadores, coincide solo palabra/frase completa.
- `clasificador.test.ts`: 19 pruebas declaradas, pruebas con SQLite en memoria y schema real; la ejecución aún no ha sido reproducida por QA.
- Cambios limitados al módulo de triaje.

## Hallazgos / controles de integración
1. **Protección de Otros (importante):** `cargarDiccionario` lanza error si falta `Otros`, por lo que Admin debe preservar la categoría obligatoria. Verificar comportamiento si se desactiva `Otros` (consulta actual no filtra `activa` en el fallback).
2. **Contrato de explicación (importante):** `ResultadoClasificacion` incluye `explicacion`, pero `shared/types/triaje.types.ts` define `SugerenciaTriaje` sin ella. En TRI-03 acordar si se agrega a `shared` o se expresa en DTO adicional. Coordinar con integrador.
3. **Alcance definido (no bloqueante):** no reconoce errores ortográficos ni derivaciones (error / errores), propio del Nivel 1 basado en coincidencias completas; documentar.
4. **Instalación (bloqueante global, no exclusivo del PR):** reproducir fallo reportado por autor de `npm ci` con `better-sqlite3@13.0.3` en Windows, sin deshabilitar indiscriminadamente los scripts de instalación.
5. **Pruebas (pendiente):** ejecutar en Node 24, `npm run check`, repetir tests con DB de prueba. Revisar si `seed` incluye `Otros` y las cinco categorías activas.

## Veredicto de aprobación
- Se puede continuar con TRI-02 y TRI-03 en paralelo.
- Fusionar solo tras aprobar compilación y pruebas en instalación verificada, más coordinación sobre campo `explicacion` y `Otros`.
- No afirmar que existe ML entrenado: se trata del clasificador de Nivel 1, por reglas.
