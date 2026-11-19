---
name: ca-find-skills
description: "Bajo pedido: buscar y evaluar skills para una necesidad concreta. Revisar origen, contenido y licencia; no instalar ni actualizar skills sin autorización explícita."
disable-model-invocation: true
---

# ca-find-skills

1. Leer `.createapp/POLICY.md` desde la raíz del proyecto. Aplicar su coordinación, autonomía, pruebas y alcance.
2. Si la tarea coincide con este rol, consultar solo las secciones necesarias de las fuentes de abajo. No invocar sus nombres originales como otras skills. Sus flujos, gates, pruebas, formato y herramientas son recomendaciones sujetas a las excepciones explícitas de POLICY.md.
3. Trabajar dentro de ese rol y devolver evidencia al coordinador. No encadenar bootstraps ni otros orquestadores.

Fuentes originales fijadas por commit (rutas relativas a la raíz del proyecto):
- `.createapp/additions/815246ddaf093c24316d/vendor/vercel-labs/skills/skills/find-skills/SKILL.md`

Consultar primero skills.sh con las herramientas web disponibles. Para búsquedas CLI, `npx skills find` requiere Node.js/npm y conexión; CreateApp no instala esas herramientas ni el CLI. No ejecutar búsquedas en cada tarea ni enviar código privado o secretos.
Revisar el SKILL.md, los scripts y la licencia de cada candidato antes de recomendarlo; popularidad no garantiza seguridad. Presentar origen, utilidad y límites sin inventar métricas. No ejecutar `npx skills add`, `npx skills update` ni `npx skills init` sin autorización explícita sobre origen y alcance local/global. No usar `-g -y` por defecto. Las nuevas skills no se consideran fuentes revisadas de CreateApp ni reemplazan su contrato.

Este perfil fue adaptado por CreateApp. No equivale a instalar el plugin oficial completo; sus hooks y comandos nativos no se instalan. Ver `.createapp/sources.lock.json` para procedencia y licencias.
