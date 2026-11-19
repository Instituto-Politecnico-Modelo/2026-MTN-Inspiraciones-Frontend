# Plan UX/UI de TRAMA con Impeccable

Fecha: 2026-11-01. Estado: simplificacion visual implementada y verificada;
las etapas propuestas originalmente se conservan como referencia, no como tareas completadas.

## Objetivo y alcance

Hacer mas facil descubrir inspiracion, compartir una obra y administrar la comunidad,
conservando la identidad y los flujos funcionales de la demo independiente de TRAMA.

- Aplicacion: [frontend actual](README.md), React 19, React Router 7, Vite 8 y TypeScript.
- Servidor de esta revision: <http://127.0.0.1:5180/>.
- Desarrollo: `npm.cmd --prefix frontend-trama run dev -- --port 5180 --strictPort`, desde la raiz.
- Requiere Node >=24.15.0. El arranque de esta revision uso Node 24.21.0 portatil.
- Trabajar solo sobre el frontend vigente; no agregar un backend, autenticacion real,
  tema oscuro, PWA, servicios pagos o dependencias sin una necesidad aprobada.
- Esta entrega usa los perfiles adaptados y las referencias pertinentes, sin activar
  el motor, los hooks ni una nueva direccion visual de Impeccable. No es una
  auditoria completa de accesibilidad o rendimiento.

## Autoridad y restricciones

Aplicar [POLICY.md](../.createapp/POLICY.md), el
[manual de marca](../manualMarca/MANUAL_MARCA_RED_ARTISTAS.md) y el frontend vigente.
El [pedido original](../prompts/miPrompt.md) aporta contexto historico; no sustituye
las decisiones actuales. El archivo de continuacion citado anteriormente no esta en el arbol.

- Conservar Trama, simbolo 11 Encuentro e Inter, tambien en titulos y marca.
- Mantener cobalto #2447D8, fondo #FAF9F6, superficie #FFFFFF y texto #202327.
- Respetar los radios existentes: controles 10 px, tarjetas 12 px y dialogos 16 px.
- Las obras aportan el color. No agregar degradados decorativos, serif editorial,
  sombras permanentes, carruseles ni un hero promocional en el feed.
- Conservar aproximadamente la grilla de obras, la barra inferior movil y la
  distincion entre Inicio y Descubrir. Acceso de escritorio: referencia 16:9, no 16:4.
- Mantener espanol rioplatense, privacidad de carpetas en la interfaz, permisos,
  confirmaciones, accesibilidad, guardado local y proteccion de cambios sin guardar.
- Las recomendaciones genericas de Impeccable, incluido su detector sobre Inter,
  no reemplazan decisiones de marca aprobadas. Registrar solo excepciones justificadas.
- Ejecutar en una sola sesion, sin subagentes ni coordinadores adicionales automaticos.

## Entrega implementada

- CreateApp 0.2.2 agrego `ca-impeccable` y `ca-find-skills`, conservando las
  selecciones previas y fuentes fijadas. `--doctor` confirmo la configuracion.
- Se quitaron slogans, explicaciones repetidas, iconos decorativos y marcos
  innecesarios. Se conservaron Inter, Encuentro, colores, radios y funcionalidades.
- Cabecera, titulos y filtros mas compactos; las cuatro categorias de Descubrir
  estan visibles en movil. Se aclararon campos opcionales, cantidades y nombres de acciones.
- Las acciones de Desafios se ajustan al ancho disponible; las tablas administrativas
  conservan desplazamiento interno con la columna de acciones fija en movil.
- A 390 x 844, la primera publicacion de Inicio paso aproximadamente de y=353 a y=199;
  en Descubrir, de y=484 a y=396. Son mediciones de esta entrega, no del diagnostico anterior.
- Verificacion final: 43 pruebas de Vitest, ESLint y build aprobados, sin diagnosticos
  del editor. Vite advierte por un paquete principal de 535 kB minificados, 164 kB gzip.
- Edge aislado: 17 rutas por 5 anchos (320, 390, 768, 1024 y 1440), 85 combinaciones
  sin desbordamiento de pagina ni controles recortados, exceptuando el scroll interno previsto.
- Ocho recorridos: filtros/Escape/foco, pestanas con teclado, guardar y recuperar,
  JPEG con recarga y proteccion de cambios, WAV, audio exclusivo, cancelacion
  administrativa a 320 px y ampliacion de texto al 200%. Los datos de prueba fueron aislados.
- Capturas locales revisadas; Playwright se reutilizo desde una carpeta temporal,
  sin agregar dependencias. No hubo commit, despliegue ni ejecucion del detector en esta entrega.

## Evidencia inicial

Diagnostico anterior a la implementacion, conservado como referencia historica:

| Superficie | Evidencia | Interpretacion |
| --- | --- | --- |
| Inicio | Grilla con imagenes cargadas, tarjetas de audio y pestanas Para vos / Seguidos / Desafios. | Conservar esta base; no reconstruir el feed. |
| Descubrir movil | A 390 x 844, la primera obra comienza aproximadamente en y=550. La fila de pestanas requiere desplazamiento horizontal. | Hay oportunidad de reducir el espacio previo al contenido y mejorar el descubrimiento de categorias. No es un desbordamiento de pagina. |
| Filtros | Obras ofrece la disciplina Musica; `/descubrir?disciplina=M%C3%BAsica` devuelve cero resultados en los datos actuales. Quitar filtros vuelve a la busqueda general. | Revisar pertinencia y explicacion de filtros. No demuestra que esa combinacion sea invalida para todos los contenidos futuros. |
| Publicar movil | A 390 x 844, Titulo comienza aproximadamente en y=718 y Publicar obra en y=1763. Hay campos obligatorios y opcionales sin una convencion visible comun. | Mejorar agrupacion, orientacion y visibilidad del progreso sin quitar requisitos. No implica exigir un asistente de varios pasos. |
| Perfil / Guardados | La privacidad esta indicada y las carpetas estan separadas de Obras. Aparece "1 referencias guardadas". | Conservar la estructura y corregir textos dependientes de cantidades. |
| Desafios | El detalle muestra consigna, formatos y fechas; participar abre un dialogo con obra existente o publicacion nueva. | Verificar continuidad y elegibilidad; no rehacer un flujo que ya existe. No se envio una participacion. |
| Administracion | En Usuarios, la tabla mide 640 px a 390 px de viewport y su contenedor 343 px. Las acciones comienzan cerca de x=540, fuera de la vista inicial. A 320 px tampoco desborda la pagina. | El desplazamiento interno funciona; la visibilidad de las acciones y la lectura movil son oportunidades de mejora. |
| Textos administrativos | El resumen muestra "1 apelaciones pendientes". | Incluir singular/plural y consistencia del vocabulario en clarify. |

Se revisaron Inicio y Descubrir en escritorio, y acceso, publicacion, perfil,
guardados, desafios y administracion a 390 px. Usuarios se midio tambien a 320 y 1440 px.
No se ejecutaron altas, publicaciones, eliminaciones ni decisiones de moderacion.

El detector sobre [Discover.tsx](src/pages/Discover.tsx),
[Editors.tsx](src/pages/Editors.tsx), [UI.tsx](src/components/UI.tsx) y
[Shell.tsx](src/components/Shell.tsx) devolvio `[]`:

```powershell
& '.github/skills/impeccable/scripts/impeccable.cmd' detect frontend-trama/src/pages/Discover.tsx frontend-trama/src/pages/Editors.tsx frontend-trama/src/components/UI.tsx frontend-trama/src/components/Shell.tsx --json
```

Eso solo acredita ese escaneo de codigo: no certifica contraste renderizado,
usabilidad, Safari, lectores de pantalla o funcionamiento automatico del hook.
Un fallo de carga `ERR_NO_BUFFER_SPACE` al abrir acceso administrativo desaparecio
al recargar; no se clasifica como defecto reproducible de la aplicacion.

## Etapas propuestas originalmente

La siguiente propuesta es historica. No activa comandos, coordinadores o hooks
automaticamente; cualquier continuacion debe respetar la politica vigente.

### 0. Capturar contexto, sin volver a elegir la marca

Comandos de chat: `/impeccable init`, seguido de `/impeccable document`.

- Capturar que hay artistas y administradores, con datos ficticios locales y sin backend.
- Tomar el manual, los tokens y el codigo como autoridad visual existente.
- Revisar con el propietario solo los vacios reales, sin repetir decisiones aprobadas.
- Consultar `/impeccable hooks status` y probar un evento compatible antes de afirmar
  que las comprobaciones automaticas funcionan en una nueva sesion de Copilot.
- Resultado: contexto de producto y sistema visual documentados para futuras tareas.
  No cambiar estilos ni generar una nueva direccion estetica en esta etapa.

### 1. Prioridad alta: encontrar contenido con menos friccion

Comandos de chat, uno por tarea:

```text
/impeccable audit Descubrir, en escritorio y movil, sin modificar la interfaz
/impeccable adapt Descubrir conservando la grilla, las categorias y la marca
/impeccable layout la cabecera y los filtros de Descubrir en movil
/impeccable clarify los filtros y los estados sin resultados de Descubrir
```

- Archivos principales: [Discover.tsx](src/pages/Discover.tsx),
  [app.css](src/styles/app.css); tocar [UI.tsx](src/components/UI.tsx) solo si la mejora
  pertenece realmente al componente compartido. Pruebas: [App.test.tsx](src/App.test.tsx).
- Compactar cabecera y distribucion de filtros sin reducir etiquetas ni areas tactiles.
- Hacer visibles o claramente descubribles las cuatro categorias a 320 y 390 px.
- Mostrar los filtros activos de forma comprensible y facilitar quitarlos.
- Comprobar si Musica como disciplina de una imagen es un caso valido del producto
  antes de eliminar una opcion por su nombre. Evitar opciones sin contenido o explicar
  el resultado, conservando el acceso a obras validas y parametros de URL existentes.
- Pruebas de comportamiento primero: cambiar categoria, aplicar/cancelar filtros,
  recuperar resultados desde el estado vacio y conservar filtros al volver de una obra.
- Aceptacion: las cuatro categorias son alcanzables con toque y teclado; URL, contador
  y resultados coinciden; no hay desbordamiento de pagina; cerrar filtros sin aplicar
  no cambia la busqueda. Propuesta de jerarquia: acercar la primera obra a y<=450 en
  390 x 844, sujeto a validar legibilidad y contenido real. No es una medicion ya lograda.

### 2. Prioridad alta: publicar con requisitos claros

Comandos de chat: `/impeccable shape el flujo de publicacion existente`,
`/impeccable clarify el formulario de publicacion` y
`/impeccable harden el formulario de publicacion`.

- Archivos: [Editors.tsx](src/pages/Editors.tsx), [UI.tsx](src/components/UI.tsx),
  [app.css](src/styles/app.css) y [App.test.tsx](src/App.test.tsx).
- Agrupar archivo, informacion de la obra y derechos/desafio con jerarquia sencilla.
- Distinguir campos obligatorios y opcionales, explicando por que se pide una
  descripcion accesible; conservar la variante de transcripcion para audio.
- Hacer evidente que falta para publicar y asociar cada error al control pertinente.
- Evaluar acciones persistentes solo si aportan orientacion: no deben tapar campos,
  foco, teclado virtual o barra inferior. No imponer varios pasos sin necesidad.
- Aceptacion: JPEG y audio valido pueden publicarse; datos incompletos, errores de
  archivo o de guardado nunca se anuncian como exito; cancelar protege el trabajo;
  textos largos no rompen el formulario. Mantener limites y comprobacion de derechos.
- Agregar pruebas que fallen antes de cualquier cambio de comportamiento. Reutilizar
  las comprobaciones existentes de [upload.ts](src/lib/upload.ts) y no reescribirlas.

### 3. Prioridad media: coherencia del recorrido de artista

Comandos de chat: `/impeccable clarify perfil y guardados`,
`/impeccable onboard los estados vacios existentes` y
`/impeccable polish detalle de obra y desafios conservando su estructura`.

- Revisar [Profile.tsx](src/pages/Profile.tsx), [PostCard.tsx](src/components/PostCard.tsx),
  [SaveDialog.tsx](src/components/SaveDialog.tsx), [Work.tsx](src/pages/Work.tsx),
  [Challenges.tsx](src/pages/Challenges.tsx) y [Access.tsx](src/pages/Access.tsx).
- Corregir singular/plural para 0, 1 y varias referencias, obras y comentarios.
- Distinguir guardar de dar like y mantener mensajes de confirmacion y privacidad.
- Conservar el acceso rapido de demo; verificar registro y cuestionario, que no
  se completaron en esta exploracion. No prometer cuentas ni recuperacion reales.
- Aceptacion: encontrar obra -> abrir -> guardar -> recuperar en carpeta; acceder
  desde desafio -> elegir/publicar obra -> volver sin perder contexto; formularios
  vacios ofrecen una salida util y nunca crean contenido de ejemplo por sorpresa.

### 4. Prioridad media: administracion eficiente en movil

Comandos de chat: `/impeccable adapt las tablas administrativas`,
`/impeccable distill la presentacion de acciones administrativas sin quitar funciones`
y `/impeccable clarify los estados y confirmaciones de administracion`.

- Archivos: [Admin.tsx](src/pages/Admin.tsx), [AdminChallenges.tsx](src/pages/AdminChallenges.tsx),
  [Shell.tsx](src/components/Shell.tsx), [CommandDialog.tsx](src/components/CommandDialog.tsx),
  [app.css](src/styles/app.css) y [App.test.tsx](src/App.test.tsx).
- Facilitar acceso a acciones por perfil sin depender de descubrir una columna fuera
  de pantalla. Evaluar detalle de fila o acceso contextual; conservar la tabla densa
  en escritorio y no convertir todas las filas en tarjetas decorativas.
- Diferenciar tareas pendientes, resoluciones y acciones destructivas; corregir cantidades.
- Aceptacion: usuarios, moderacion y propuestas son operables a 390 px; accion y sujeto
  son inequivocos; cancelar no cambia datos; confirmar conserva permisos, motivos y
  actividad; ninguna accion peligrosa se ejecuta con un unico toque accidental.

### 5. Prioridad posterior: acabado y rendimiento medido

Comandos de chat: `/impeccable polish` sobre las pantallas modificadas y,
solo si las mediciones lo justifican, `/impeccable optimize la carga inicial de TRAMA`.

- Revisar consistencia de espacios, titulos, foco y feedback en componentes existentes.
- Usar `animate` solo para una transicion que ayude a entender el estado y respetar
  `prefers-reduced-motion`. No priorizar bolder, colorize u overdrive para esta app.
- Medir carga inicial, imagenes, saltos de layout y division del bundle antes de proponer
  una optimizacion. El README registra una advertencia historica de unos 537 kB;
  actualizar la medicion antes de atribuirla al estado actual.
- `live` o `generate` son opcionales para comparar una composicion concreta despues
  de acordar el objetivo; no introducir variantes, servicios o costes por defecto.

## Verificacion por entrega

1. Acordar un objetivo acotado y conservar una captura anterior de la misma ruta,
   estado y viewport. No ejecutar todo el plan de una sola vez.
2. Para cambios de comportamiento, escribir primero una prueba de reproduccion en el
   runner existente y comprobar que falla; hacer el cambio minimo y repetir esa prueba.
   Para ajustes visuales, comparar directamente navegador y estilos.
3. Ejecutar pruebas de rutas cuando se toquen flujos compartidos:
   `npm.cmd --prefix frontend-trama test -- src/App.test.tsx`.
4. Verificar 320, 390, 768 y 1440 px en las rutas afectadas; teclado, zoom 200%, foco
   visible, dialogos, textos largos, contenido vacio, errores y estados pendientes.
   Las tablas pueden desplazarse internamente, pero la pagina no debe hacerlo.
5. Buscar contraste AA, nombres accesibles y controles tactiles comodamente operables;
   conservar objetivos de 44 x 44 px cuando corresponda, sin afirmar conformidad total
   por una sola medicion o un escaneo estatico.
6. Si se acuerda una revision con detector, revisar cada hallazgo contra la marca;
  no silenciar reglas completas para obtener cero ni activar motor o hooks por defecto.
7. Al cerrar cambios de codigo, ejecutar `npm.cmd --prefix frontend-trama run lint` y
   `npm.cmd --prefix frontend-trama run build`; repetir tests de dominio/repositorio
   si se modificaron sus contratos. No instalar otro runner por defecto.
8. Presentar cambios, capturas comparables, pruebas ejecutadas y limites pendientes.
   Safari/iOS, lector de pantalla real y Figma autenticado siguen pendientes hasta
   comprobarlos con herramientas o dispositivos adecuados.

## Continuacion opcional

Esta entrega no equivale a completar todas las etapas originales. Quedan fuera
la optimizacion de rendimiento medido, una auditoria formal de accesibilidad,
Safari/iOS, lector de pantalla real, Figma autenticado y una nueva verificacion
completa de altas, desafios y decisiones de moderacion. Continuar solo con un
objetivo adicional acordado; no reiniciar el proceso de identidad visual.