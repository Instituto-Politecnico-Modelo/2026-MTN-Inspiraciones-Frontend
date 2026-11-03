# Trama

Comunidad de artistas con publicación de imágenes y audio, descubrimiento,
carpetas privadas, desafíos y administración. La aplicación se conecta a la
**API Spring Boot de `2026-MTN-Inspiraciones-Api`**, incluida la autenticación.

## Estructura

| Ubicación | Contenido |
| --- | --- |
| [frontend-trama](frontend-trama/) | Única aplicación: código, pruebas, recursos locales y configuración de despliegue. |
| [manualMarca](manualMarca/) | Manual, tokens, recursos originales y decisiones visuales de Trama. |
| [prompts](prompts/) | Contexto de continuación y pedido original, identificado como histórico. |
| [.github](.github/) | Workflow de despliegue y personalizaciones de Copilot. |
| [.agents](.agents/) y [.createapp](.createapp/) | Skills, política y fuentes de trabajo del proyecto. |

El frontend anterior, sus especificaciones, evidencias y prototipos HTML fueron
retirados del árbol actual. Su historia permanece en Git.

## Ejecutar

Requiere **Node.js >=24.15.0** y el backend en `http://localhost:8080`.
Desde la raíz del repositorio:

```sh
npm --prefix frontend-trama ci --ignore-scripts
npm --prefix frontend-trama run dev
```

Abrir <http://127.0.0.1:5180/>. En PowerShell se puede usar `npm.cmd` si la
política de ejecución bloquea `npm`. Si el puerto está ocupado, añadir
`-- --port 5181` al comando de desarrollo.

El ingreso y el registro usan la API real. El servidor de desarrollo reenvía
`/api` al backend; los datos se guardan en ese servicio.

La guía funcional, los recursos y los límites están en
[frontend-trama/README.md](frontend-trama/README.md).

## Verificar

```sh
npm --prefix frontend-trama test
npm --prefix frontend-trama run lint
npm --prefix frontend-trama run build
npm --prefix frontend-trama run preview
```

El build queda en la carpeta `dist` del frontend. Preview usa
<http://127.0.0.1:4180/>. No abrir el HTML compilado mediante `file://`.

## Despliegue

El [workflow existente](.github/workflows/deploy-frontend.yml) ahora construye
[frontend-trama/Dockerfile](frontend-trama/Dockerfile). Se conservan la rama
`dev`, el environment `testing` y la integración con Dokploy:

```text
push a dev -> build Docker -> GHCR -> solicitud de despliegue en Dokploy
```

También puede iniciarse con `workflow_dispatch` sobre `dev`. No se despliega
desde otras ramas. La imagen se publica como
`ghcr.io/<propietario>/<repositorio>:latest` y `sha-<commit>`.

Configurar la aplicación de Dokploy con proveedor Docker, esa imagen y puerto
interno **80**. Para una imagen privada, el registro necesita credenciales de
lectura de paquetes. El environment `testing` conserva estos secrets:

| Secret | Uso |
| --- | --- |
| `DOKPLOY_URL` | URL HTTPS del panel, sin el sufijo `/api`. |
| `DOKPLOY_API_KEY` | Credencial para solicitar el despliegue. |
| `DOKPLOY_APPLICATION_ID` | Identificador de la aplicación en Dokploy. |

El workflow usa `GITHUB_TOKEN` para publicar en GHCR. Trama no necesita los
antiguos argumentos de compilación `VITE_API_URL`, mocks, OAuth o geolocalización.
En el entorno `testing`, **Domains** publica ambos servicios en el mismo host
HTTPS `dev-inspiraciones.policloudservices.ipm.edu.ar`:

| Servicio | Path | Container Port | Internal Path | Strip Path |
| --- | --- | --- | --- | --- |
| Frontend | `/` | `80` | `/` | Desactivado |
| API | `/api` | `8080` | `/` | Desactivado |

La ruta del backend debe ser `/api` en minúsculas, no `/API`. Dokploy envía las
peticiones directamente a la API, conservando el prefijo `/api`. No se necesita
`API_UPSTREAM` ni reconstruir el frontend para corregir esta ruta.

La imagen utiliza Node 24.21.0 para compilar y Nginx para servir el resultado.
Incluye `/healthz`, retorno al HTML de la SPA para rutas de navegación y respuestas
404 para recursos inexistentes y solicitudes a `/api` que lleguen al frontend.
No incorpora un backend: debe estar desplegado por separado. Un 404 de Nginx
durante el registro indica que hay que revisar el enrutamiento del servicio API.
El éxito del job significa que Dokploy aceptó la solicitud; el resultado final
del despliegue se consulta en su panel.

### Perfiles y publicaciones

Los enlaces de perfiles usan `/nombre-de-usuario`. Los enlaces anteriores
`/perfil` y `/perfil/:id` siguen funcionando y redirigen al nombre actual.
Los nombres admiten entre 3 y 50 letras ASCII, numeros, puntos, guiones y guiones
bajos; la API controla la unicidad sin distinguir mayusculas y minusculas y
reserva los nombres de las rutas de la aplicacion. Las cuentas antiguas con
un nombre reservado conservan su enlace por ID.

Descubrir > Artistas consulta el directorio compartido aun sin escribir una
busqueda (hasta 100 cuentas activas). La busqueda encuentra coincidencias dentro
del nombre visible o del nombre de usuario, incluyendo cuentas sin publicaciones.
Un perfil puede abrirse directamente sin datos precargados; sus obras requieren
iniciar sesion, igual que el resto del contenido protegido por la API.

Desplegar primero la API actualizada y despues el frontend: el cliente utiliza
`GET /api/usuarios/username/{username}` y la busqueda ampliada. Las imagenes
admiten hasta 5 MB. El contenedor API debe poder escribir en
`/app/var/uploads/imagenes` como UID/GID `10001:10001`, con un volumen persistente
en esa misma ruta para no perder archivos al recrear el contenedor. Publicar
solo el frontend no corrige los permisos del servidor de imagenes.

Prueba local, con el motor de Docker ejecutándose:

```sh
docker build -t trama-frontend ./frontend-trama
docker run --rm -p 127.0.0.1:8081:80 trama-frontend
```

Abrir <http://127.0.0.1:8081/> o consultar `/healthz` en ese puerto.
Este contenedor aislado no conecta `/api`: para los flujos completos usar el
servidor de desarrollo con el backend o el enrutamiento de Dokploy indicado.

## Continuar el trabajo

Leer [AGENTS.md](AGENTS.md), la [política del proyecto](.createapp/POLICY.md) y el
[manual de marca](manualMarca/MANUAL_MARCA_RED_ARTISTAS.md). Conservar la identidad
de marca y revisar los cambios locales antes de editar. El
[pedido original](prompts/miPrompt.md) es histórico; el archivo de continuación
citado anteriormente no está presente.

La simplificación de interfaz del 1 de noviembre conserva los flujos existentes:
menos texto repetido, controles más compactos y mejor acceso móvil. Se verificaron
43 pruebas, lint, build y 85 combinaciones de ruta y ancho en Edge. CreateApp agregó
los perfiles `ca-impeccable` y `ca-find-skills`, sin cambiar la marca ni activar
otro coordinador. El [plan UX/UI](frontend-trama/PLAN_UX_UI_IMPECCABLE.md) registra
lo implementado y separa las propuestas opcionales y verificaciones pendientes.