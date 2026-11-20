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

- La bandeja permite buscar y filtrar incidencias por estado, categoría, prioridad y técnico. El técnico ve sus tickets asignados; agentes y administradores gestionan la cola.
- Agentes y administradores pueden asignar o reasignar técnicos. El técnico registra la solución antes de marcar un ticket como resuelto; el agente o administrador puede cerrarlo. Los cambios quedan en el historial.
- El Dashboard permite filtrar tickets y decisiones por fecha de creación, muestra la carga por técnico y compara las sugerencias aceptadas con los aciertos obtenidos al probar el clasificador con tickets apartados.
- La página Triaje compara la sugerencia por reglas con otra basada en tickets anteriores; muestra si coinciden y qué términos favorecieron cada categoría.

El método aprende de las categorías finales confirmadas por agentes. Para medir sus aciertos, se prueba cada ticket sin usarlo para aprender esa sugerencia. Si faltan tickets revisados por categoría, el panel avisa que todavía no puede medirlo. Los ejemplos de la demo son ficticios y no representan el desempeño con incidencias reales. El nombre técnico del método es Naive Bayes.
