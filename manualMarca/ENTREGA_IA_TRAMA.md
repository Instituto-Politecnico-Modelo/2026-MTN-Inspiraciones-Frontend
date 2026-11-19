# Entrega para otra IA · Trama

Versión 2.0 · 27 de octubre de 2026

## Encargo y estado

Se solicita una red social para artistas que permite compartir dibujos, música, esculturas y otras creaciones, descubrir referencias mediante filtros, explorar música y samples, encontrar lugares físicos y participar en desafíos. Tecnología requerida: React. Esta entrega es planificación y diseño; no autoriza implementar ni publicar una aplicación.

## Identidad confirmada

- Nombre: Trama; palabra gráfica: trama, en minúsculas.
- Logo oficial: 11 Encuentro. Dos bandas angulares redondeadas, abiertas y dispuestas en diagonal. Archivo de apoyo: assets/05_simbolo_encuentro.png. Fuente de forma: opción 11, fila inferior central de assets/referencia_11_original.png. No usar ningún otro logo de esa lámina.
- Paleta: B Cobalto neutro. Acción #2447D8, fondo #FAF9F6, paneles #FFFFFF, tinta #202327 y selección #E8EDFF.
- Tipografía: T2 Inter para todo, incluidos títulos y palabra de marca. Pesos 400, 500, 600 y 700.
- Estilo: minimalista, limpio, mayormente neutral. Las obras aportan color. Sin coral de marca, degradados, sombras permanentes o serif editorial.

## Lectura obligatoria

Leer MANUAL_MARCA_RED_ARTISTAS.md y TOKENS_TRAMA.json. El PDF permite evaluar composición y ejemplos. Las tablas y tokens prevalecen sobre diferencias de imágenes generadas. Las imágenes no son capturas de una implementación.

## Pantallas y estructura

Ocho pantallas requeridas: Cuestionario, Registro, Ingreso, Inicio, Desafíos, Descubrir, Perfil y Editar perfil. Cuatro destinos principales: Inicio, Descubrir, Desafíos y Perfil. Publicar es una acción independiente. Descubrir organiza Obras, Música, Lugares y Artistas. Los detalles de contenido y estados están en el capítulo 13.

El diseño es adaptable a web y móvil. Una app nativa o PWA no está aprobada. Tema oscuro, seguimiento, guardados y reproducción persistente son extensiones propuestas. Publicación y detalle requieren completar sus contratos de datos y permisos.

## Reglas exactas

Base de lectura Inter 16/24, metadatos 14/20, título móvil 28/34 y escritorio 36/44. Controles radio10, tarjetas12, paneles16. Botones al menos44px de alto; campos48px; área táctil44×44 recomendada. Espacios4,8,12,16,24,32,48,64. Márgenes móviles16px. El foco debe verse y no quedar bajo barras fijas. Revisar anchos320,390,768,1024,1440px.

Mantener carga, vacío, error, éxito, foco, seleccionado, deshabilitado y estados de medios. No usar solo color para transmitir estado. Texto normal objetivo4,5:1; contornos o gráficos necesarios3:1. Las imágenes conservan autoría y proporciones; el audio se inicia a petición y solo se reproduce una pieza a la vez.

## Límite de arquitectura

El archivo constitutionFrontend_recibida.txt mezcla interfaz con un servicio de analytics de background. No trasladar MySQL, Redis, jobs ni lógica de rankings al navegador. El frontend presenta resultados y emite interacciones mediante contratos por acordar. No inventar porcentajes de afinidad, métricas, endpoints o operaciones exitosas.

## Pendientes que no reabren la identidad

Producir el SVG maestro fiel al logo11 y revisar tamaños pequeños; acordar autenticación y API; confirmar funciones opcionales; definir medios admitidos, ubicación, licencias y permisos. El símbolo está elegido; no cambiarlo durante estas tareas. La disponibilidad registral del nombre no fue comprobada.

## Criterios de entrega futura

Cuando el usuario autorice construir, entregar las ocho pantallas, estados completos, navegación compartida, componentes de medios coherentes, accesibilidad revisada y una explicación de lo que está integrado frente a lo que usa datos ficticios. La especificación detallada y criterios de aceptación se encuentran en los capítulos18 y19 del manual.
