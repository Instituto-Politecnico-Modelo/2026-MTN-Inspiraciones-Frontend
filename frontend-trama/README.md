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

## Desplegar en Dokploy

En el entorno `testing`, ambos servicios usan el mismo dominio HTTPS:
`dev-inspiraciones.policloudservices.ipm.edu.ar`. En **Domains**, configurar:

| Servicio | Path | Container Port | Internal Path | Strip Path |
| --- | --- | --- | --- | --- |
| Frontend | `/` | `80` | `/` | Desactivado |
| API | `/api` | `8080` | `/` | Desactivado |
| Push | `/api/push-notifications` | `3001` | `/` | Desactivado |

Dokploy envia `/api` directamente al backend, conservando el prefijo que
esperan sus endpoints. La ruta debe ser **`/api` en minusculas**, no `/API`.
El backend debe estar desplegado por separado; esta imagen no lo incluye.
No hace falta configurar `API_UPSTREAM` ni `VITE_API_URL` con este enrutamiento.

Si el registro responde `404` con "El recurso ya no esta disponible", comprobar
la ruta del dominio del servicio API: si no coincide, la solicitud llega al
Nginx del frontend, que rechaza `/api`. No hace falta reconstruir el frontend
para corregir esa ruta en Dokploy.

## Notificaciones

La campana esta disponible para cuentas activas. La activacion solicita permiso
al navegador y registra el token FCM con el JWT de la cuenta. Las notificaciones
recibidas con Trama abierta aparecen como avisos y en el dialogo de la campana;
en segundo plano, `public/push-sw.js` muestra la notificacion del sistema.
El dialogo conserva solo los avisos de la sesion, no un historial del servidor.
Al salir o cambiar de cuenta se desactiva la suscripcion local y se solicita la
baja del token, incluso si falla la conexion con el servidor.

Requiere HTTPS (o localhost) y el servicio Push en el mismo origen. El proxy de
desarrollo y preview envia `/api/push-notifications` a `localhost:3001`, antes
del proxy general a Spring. El SDK de Firebase se carga solo al activar o
reconectar un dispositivo, no al abrir Inicio por primera vez.

Push expone `GET /api/push-notifications/config` con estos campos publicos:
`apiKey`, `appId`, `projectId`, `messagingSenderId` y `vapidKey`. Configurar en
ese servicio `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_APP_ID`, `FIREBASE_PROJECT_ID`,
`FIREBASE_MESSAGING_SENDER_ID` y `FIREBASE_VAPID_KEY` del mismo proyecto Firebase.
No colocar la clave privada de Firebase Admin en el frontend.

El circuito de likes y comentarios usa `EVENTOS_MODULE_ENABLED=true`,
`EVENTOS_MODULE_URL` (URL privada de Eventos) y `EVENTOS_MODULE_API_KEY` en
Spring; la clave debe coincidir con `EVENTS_API_KEY` de Eventos. Eventos y Push
deben compartir `REDIS_URL`. No requiere habilitar el outbox experimental.

Antes de reiniciar Spring en Dokploy, respaldar los archivos de imagen y
configurar su almacenamiento persistente. Cambiar variables no aplica la
configuracion a procesos que ya estan ejecutandose.

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

## Perfil

Los contadores de seguidores y seguidos abren una ventana con las cuentas
activas de cada lista. Cada fila muestra avatar, nombre y @usuario, y permite
visitar el perfil. Si la lista esta vacia, se muestra un mensaje explicativo.
La ventana se cierra con su boton de cierre o con Escape.

## Pruebas

`npm test` usa un respaldo local en memoria (`src/data/repository.ts`) solo para
pruebas de interfaz. La prueba contra la API real se ejecuta con
`TRAMA_LIVE=1 npx vitest run src/data/api.live.test.ts`.
