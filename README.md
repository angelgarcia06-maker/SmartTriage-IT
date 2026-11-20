# SmartTriage IT
Prototipo académico de mesa de ayuda y triaje de incidentes. **No es TI SmartDesk AI institucional.**

## Requisitos
Node.js 22.12+ o 24 LTS, npm, Git. Para menor fricción use Node 24 LTS.

## Iniciar la demo en Windows

Instala Node.js 24 LTS una sola vez. Descarga el ZIP del repositorio, descomprímelo y haz doble clic en `INICIAR_DEMO.bat`. La primera vez instala las dependencias automáticamente y después inicia la aplicación con 40 tickets de demostración. Deja abierta la ventana que aparece.

Abre [SmartTriage IT](http://127.0.0.1:5173) e ingresa con una de estas cuentas:

| Usuario | Qué puedes revisar |
| --- | --- |
| `admin` | Panel de métricas, catálogos y diccionario |
| `agente` | Bandeja de tickets, registro y sugerencias de triaje |
| `tecnico1` a `tecnico4` | Tickets asignados a cada técnico |

La contraseña de todas las cuentas de demo es `Cambiar123!`. Para ver el Dashboard, inicia sesión con `admin` y abre **Dashboard** desde la pantalla de inicio.

El primer arranque genera una base local con 40 tickets ficticios, historial y decisiones de triaje. Los siguientes inicios conservan los cambios. Cada copia del ZIP tiene su propia base.

## Funciones de la aplicación

- La bandeja permite buscar y filtrar incidencias por la categoría y prioridad finales cuando ya fueron confirmadas. El detalle conserva también la sugerencia original. Los tickets se muestran en páginas de 10.
- El detalle presenta la sugerencia original, la decisión final y el historial. Los técnicos pueden consultar los tickets asignados.
- El panel de administración muestra la carga abierta por técnico y las decisiones de triaje aceptadas, corregidas y pendientes.

La bandeja permite buscar y filtrar incidencias y las muestra en páginas de 10. El detalle incluye la sugerencia, la decisión y el historial. El Dashboard administrativo presenta métricas de tickets y decisiones de triaje.
