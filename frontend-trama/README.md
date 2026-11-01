# Trama

Frontend independiente de la comunidad de artistas. Incluye la experiencia de
artista y el panel administrativo como una **demo local persistente, sin backend**.
Es la unica aplicacion del repositorio; las implementaciones anteriores fueron
retiradas. La estructura y el despliegue se describen en el
[README principal](../README.md).

## Ejecutar

Requiere **Node.js >=24.15.0**. Verificado con Node 24.21.0 y npm 11.19.0.

Desde la raiz del repositorio:

```sh
cd frontend-trama
node --version
npm ci --ignore-scripts
npm run dev
```

Abrir <http://127.0.0.1:5180/>. En PowerShell se puede usar `npm.cmd` si la
politica de ejecucion bloquea el comando `npm`.

El puerto es estricto: si esta ocupado, usar `npm run dev -- --port 5181`.
El servidor escucha solamente en `127.0.0.1`.

En esta sesion se uso un runtime portatil, sin reemplazar el Node global de la PC.
Mientras esa carpeta temporal exista, se puede reutilizar en PowerShell:

```powershell
$env:PATH = (Join-Path $env:TEMP 'trama-node-runtime\node-v24.21.0-win-x64') + ';' + $env:PATH
```

En otra PC, instalar una version compatible de Node antes de `npm ci`.

```sh
npm test
npm run lint
npm run build
npm run preview
```

Preview: <http://127.0.0.1:4180/>. Tambien admite `-- --port 4181`.
El build se genera en `dist/`; no abrir el HTML directamente con `file://`.
Un alojamiento estatico debe redirigir las rutas de la SPA a `index.html`.

El contenedor y el workflow existentes ahora construyen este proyecto. Consultar
[Despliegue](../README.md#despliegue) para Docker y Dokploy. No se requieren
variables de API ni de autenticacion para esta demo local.

## Perfiles y datos

Desde `/ingresar`, **Como artista** abre el perfil Mora Vidal y **Como admin**
abre Equipo Trama. `/acerca` permite elegir cualquier perfil local no eliminado.
Ines Duarte comienza suspendida para demostrar el proceso de apelacion.

Registro crea un perfil solo en este navegador. El correo es un identificador
local; la contrasena de muestra admite cualquier texto de al menos 8 caracteres,
no se verifica ni se guarda. No usar credenciales ni datos personales reales.
No se envian correos ni existen cuentas de servidor.

Los datos se guardan en IndexedDB (`trama-frontend-demo-v1`, almacen
`application`, clave `state`). La sesion de cada pestana usa `sessionStorage`
(`trama-demo-profile`). Las escrituras son transaccionales y las pestanas pueden
recibir actualizaciones mediante `BroadcastChannel`.

El origen incluye protocolo, host y puerto: `localhost`, `127.0.0.1`, otro puerto
y otro navegador tienen datos separados. Git no transporta los datos del navegador.

**Reiniciar datos**, en `/acerca`, solicita confirmacion y reemplaza todo el estado
local por los ejemplos iniciales, incluidos los archivos subidos. Tambien cierra
la sesion de esa pestana. Cancelar no modifica nada; un fallo de escritura no se
anuncia como exito. Las fechas de los desafios de ejemplo se regeneran al reiniciar.

Las carpetas son privadas dentro de la interfaz y las operaciones de la demo,
incluso frente al perfil administrador. Esto **no es una frontera de seguridad**:
quien controla el navegador puede inspeccionar o modificar su almacenamiento.

## Recorridos

| Area | Rutas principales |
| --- | --- |
| Acceso local | `/ingresar`, `/registro`, `/recuperar`, `/salir` |
| Comunidad | `/inicio`, `/descubrir`, `/obra/:id` |
| Perfil y guardados | `/perfil`, `/perfil/:id`, `/perfil/editar`, `/carpeta/:id`, `/cuestionario` |
| Publicaciones | `/publicar`, `/obra/:id/editar` |
| Desafios | `/desafios`, `/desafios/:id`, `/desafios/proponer`, `/desafios/mis-propuestas` |
| Revision de cuenta | `/apelacion` |
| Administracion | `/admin/resumen`, `/admin/usuarios`, `/admin/publicaciones`, `/admin/accesos` |
| Moderacion | `/admin/moderacion`, `/admin/moderacion/reportes/:id`, `/admin/moderacion/apelaciones/:id` |
| Consignas y propuestas | `/admin/desafios`, `/admin/desafios/nuevo`, `/admin/desafios/:id/editar`, `/admin/solicitudes`, `/admin/solicitudes/:id` |
| Informacion y exportacion | `/acerca`, `/admin/reportes` |

Las rutas se definen en [src/App.tsx](src/App.tsx). Administracion e informacion
se cargan bajo demanda. Los permisos se vuelven a comprobar en los comandos de
[src/data/store.ts](src/data/store.ts), ademas de las guardas de navegacion.

- Likes, seguimiento, comentarios y carpetas privadas con alta, renombrado y baja.
- Imagenes JPG, PNG o WebP de hasta 8 MiB; audio MP3, WAV, Ogg o M4A de hasta 16 MiB.
- Un archivo por obra, descripcion accesible y confirmacion de derechos; SVG no se admite como carga del usuario.
- Reproduccion exclusiva, avance, pausa al salir y reintento de una fuente de audio fallida.
- Participacion con obras propias en desafios abiertos y del formato permitido.
- Aprobar una propuesta no publica un desafio: requiere definir y confirmar la consigna, sus fechas y formatos.
- Fechas de desafios en Buenos Aires, UTC-3, independientemente de la zona del dispositivo.
- Ocultar, restaurar y eliminar obras; suspender, reactivar y eliminar perfiles; resolver reportes y apelaciones.
- Confirmacion de decisiones, motivos cuando corresponden y actividad administrativa local.
- CSV de la seleccion filtrada, sin correos ni carpetas privadas y con neutralizacion de formulas.

## Marca y recursos

Se conserva Inter, el simbolo 11 Encuentro y los colores del
[manual de marca](../manualMarca/MANUAL_MARCA_RED_ARTISTAS.md). Los recursos se
sirven localmente, sin depender de una descarga externa durante la navegacion.

- Inter: [licencia OFL](public/fonts/OFL.txt).
- Lucide y trazos derivados de Feather: [avisos y licencias](public/licenses/lucide.txt).
- Fotografias: referencias de Unsplash enumeradas en [src/data/seed.ts](src/data/seed.ts) y `/acerca`.
- Ilustraciones SVG y dos audios sintetizados de ejemplo; los audios se identifican como CC0.

Los nombres de artistas y relatos de las obras son ficticios y no atribuyen la
autoria de las fotografias a esos perfiles. El mapa y sus lugares tambien son
ilustrativos: no sirven como direcciones o servicios reales.

## Verificacion realizada

Ultima continuacion: 30 de octubre de 2026, horario de Buenos Aires.

- **38 pruebas** de Vitest: dominio, IndexedDB y rutas/interacciones. Incluyen escrituras simultaneas, fallos de escritura, reinicio fallido y guardas de permisos.
- **ESLint y build de produccion aprobados**; `npm audit` informo **0 vulnerabilidades conocidas** con el lockfile instalado.
- Chromium integrado: alta, intereses, perfil con foto, publicaciones de imagen y WAV, edicion, recarga persistente, carpetas, likes, seguimiento y comentarios.
- Archivos vacios, no admitidos, demasiado grandes y corruptos; restricciones de formato de desafios; reintento de imagen y audio tras un fallo de carga.
- Propuesta, aprobacion y publicacion separadas; moderacion, restauracion, eliminacion, suspension, apelacion, roles, archivo de desafios y reinicio confirmado/cancelado.
- **160 combinaciones de ruta y ancho**: 320, 390, 768, 1024 y 1440 px, sin desbordamiento de pagina ni controles recortados en esas comprobaciones. Las tablas administrativas conservan su desplazamiento horizontal interno.
- Teclado en pestanas, foco visible, filtros y menu administrativo movil, proteccion de cambios sin guardar y retorno al filtro de origen.
- Edge **156.0.4314.50**, aislado y headless: Escape nativo, retorno de foco y descarga real del CSV filtrado. Capturas completas de Inicio, acceso y guardados; simbolo visible a 16 y 24 px, tambien comprobado por pixeles.

La comprobacion adicional utilizo Playwright Core 1.64.1 en una carpeta temporal,
sin incorporarlo a las dependencias del proyecto. Esas comprobaciones de navegador
no forman parte de `npm test`; las regresiones automatizadas quedan en
[src/App.test.tsx](src/App.test.tsx) y los tests de [src/data](src/data/).

## Limites pendientes

- Figma solicito autenticacion. La revision visual se hizo contra el manual y las decisiones aprobadas, no contra un lienzo de Figma accesible.
- No se certificaron Safari, iOS, lectores de pantalla reales ni todos los codecs de audio. Las cargas reales verificadas fueron JPEG y WAV.
- Vite advierte que el bloque principal ronda 537 kB minificados, 164 kB con gzip. El build es valido; queda pendiente reducir la carga inicial si se requiere optimizacion de rendimiento.
- Sin backend, autenticacion real, sincronizacion entre equipos, recuperacion de contrasenas, recomendaciones calculadas, PWA ni tema oscuro.
- IndexedDB tiene cuotas variables; los archivos se almacenan como datos locales y pueden agotar el espacio del navegador. No es un servicio de respaldo.