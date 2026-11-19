---
name: ca-impeccable
description: "Bajo pedido: refinar o auditar una interfaz con Impeccable. Respetar DESIGN.md y el alcance aprobado; no duplicar revisiones ni iniciar otro proceso visual."
disable-model-invocation: true
---

# ca-impeccable

1. Leer `.createapp/POLICY.md` desde la raíz del proyecto. Aplicar su coordinación, autonomía, pruebas y alcance.
2. Si la tarea coincide con este rol, consultar solo las secciones necesarias de las fuentes de abajo. No invocar sus nombres originales como otras skills. Sus flujos, gates, pruebas, formato y herramientas son recomendaciones sujetas a las excepciones explícitas de POLICY.md.
3. Trabajar dentro de ese rol y devolver evidencia al coordinador. No encadenar bootstraps ni otros orquestadores.

Fuentes originales fijadas por commit (rutas relativas a la raíz del proyecto):
- `.createapp/additions/815246ddaf093c24316d/vendor/pbakaus/impeccable/.agents/skills/impeccable/SKILL.md`

Integración de consulta sin motor ni launcher. Leer PRODUCT.md y DESIGN.md existentes directamente; no exigir init ni otra entrevista para refinar una interfaz. Resolver las referencias relativas desde `.createapp/additions/815246ddaf093c24316d/vendor/pbakaus/impeccable/.agents/skills/impeccable/`. Consultar `reference/craft-floor.md` antes de editar UI y solo la guía pertinente, por ejemplo `reference/critique.md`, `reference/audit.md` o `reference/polish.md`.
No ejecutar `impeccable context`, instalar o descargar binarios, activar hooks, crear atajos con pin ni contactar el catálogo remoto. El detector y los modos live/generate requieren una instalación oficial separada y autorización explícita; no están incluidos en este perfil. Usar las herramientas de navegador disponibles para verificar el resultado, sin afirmar que se ejecutó el detector.

Este perfil fue adaptado por CreateApp. No equivale a instalar el plugin oficial completo; sus hooks y comandos nativos no se instalan. Ver `.createapp/sources.lock.json` para procedencia y licencias.
