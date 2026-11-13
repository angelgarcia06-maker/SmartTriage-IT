# Módulo Admin

Los paneles originales están integrados en la aplicación autenticada y solo
son accesibles para administradores:

- `/admin/dashboard` — `DashboardPanel`, métricas reales de SQLite.
- `/admin/catalogos` — `CatalogosPanel`, CRUD de categorías y grupos.
- `/admin/diccionario` — `DiccionarioPanel`, CRUD de palabras y prueba del
  clasificador en vivo.

La navegación a estas pantallas también se muestra únicamente a administradores.
