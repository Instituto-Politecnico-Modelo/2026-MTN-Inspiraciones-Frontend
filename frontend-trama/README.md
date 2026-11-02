# Trama

Frontend de la comunidad de artistas (experiencia de artista y panel administrativo).
Se conecta a la API Spring Boot de `2026-MTN-Inspiraciones-Api`.

## Ejecutar

Requiere Node.js >=24.15.0 y la API en `http://localhost:8080`
(se puede levantar todo con `start-all.ps1` / `start-all.sh` de la carpeta superior).

```sh
npm ci --ignore-scripts
npm run dev        # http://127.0.0.1:5180/
npm test
npm run lint
npm run build
```

El servidor de desarrollo y `preview` redirigen `/api` a la API mediante el proxy
de `vite.config.ts` (la API no define CORS). En produccion, servir `/api` y el
frontend bajo el mismo origen.

## Sesion y datos

- Ingreso, registro y apelaciones usan los endpoints reales de autenticacion.
  El token se guarda en `localStorage` (`trama-token`).
- Todo el contenido (obras, carpetas, comentarios, seguimientos, desafios,
  propuestas, reportes, moderacion) se lee y escribe en la API.
- `src/data/api.ts` adapta la API al modelo de la interfaz. Como la API no tiene
  titulo, texto alternativo, disciplina, tecnica ni licencia, se guardan al final
  del contenido de la publicacion.

## Limitaciones conocidas

- Audio, ocultar/restaurar obras y desarchivar desafios no existen en la API: esas
  acciones muestran un aviso y no se ofrecen en el flujo.
- La API no informa que obras reaccionó el usuario; los "me gusta" propios se
  recuerdan en el navegador.
- El nombre de usuario admite hasta 10 caracteres.

## Pruebas

`npm test` usa un respaldo local en memoria (`src/data/repository.ts`) solo para
pruebas de interfaz. La prueba contra la API real se ejecuta con
`TRAMA_LIVE=1 npx vitest run src/data/api.live.test.ts`.
