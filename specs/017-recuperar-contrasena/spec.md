# SPEC 017 Recuperación de contraseña en el frontend

**Fecha:** 19 de noviembre de 2026.
**Repositorio institucional actual:** `Instituto-Politecnico-Modelo/2026-MTN-Inspiraciones-Frontend`. La carpeta local conserva el nombre `2026-MTN-Inspiraciones-UnionUserAdmin`.
**Aplicación objetivo:** `frontend-trama`.
**Estado:** implementado en `frontend-trama`. Pruebas de interfaz y cliente HTTP, compilación y lint verificados el 19 de noviembre.
**Especificación del servidor:** [SPEC del backend](../../../2026-MTN-Inspiraciones-Api/specs/017-recuperar-contrasena/spec.md).
 
## 1 Objetivo

Reemplazar la pantalla informativa de recuperación por un recorrido completo y accesible: ingresar correo, recibir código, elegir una contraseña nueva y volver al login. Debe funcionar para cualquier persona con cuenta activa, sin una sesión previa y sin asistencia de administración.

Se conserva la marca Trama y el diseño de acceso existente. No se rediseñan registro ni login y no se utiliza Firebase Authentication para cambiar contraseñas.

## 2 Estado observado y archivos a integrar

| Archivo actual | Estado | Cambio previsto |
| --- | --- | --- |
| `frontend-trama/src/App.tsx` | Existe la ruta pública `/recuperar`. | Mantener la URL y permitir entrar sin JWT. |
| `frontend-trama/src/pages/Access.tsx` | Login enlaza a `/recuperar`; `RecoveryPage` muestra que la función no está disponible. | Sustituir el aviso por el flujo completo. Extraer una página si mejora la claridad del archivo. |
| `frontend-trama/src/data/api.ts` | Cliente remoto común; `ApiError` conserva estado, mensaje y código. | Añadir funciones de recuperación y conservar tiempo de espera e intentos restantes. |
| `frontend-trama/src/components/ui.tsx` | Componentes compartidos de formularios y acciones, sujetos a confirmar sus exports al implementar. | Reutilizar `Field`, `Button`, `ErrorMessage`, `IconButton` y patrones existentes que correspondan. |
| `frontend-trama/package.json` | Vitest, Testing Library, TypeScript, Vite y ESLint. | Usar herramientas existentes, sin agregar una biblioteca de formularios u OTP por defecto. |

La carpeta antigua `Union` no es el objetivo de esta implementación. Las especificaciones antiguas que haya allí no reemplazan el código del frontend desplegado.

## 3 Recorrido y pantallas

Todo sucede en `/recuperar` mediante estados de la misma página. No incluir correo, OTP o contraseña en URL, historial de navegación ni parámetros de consulta.

### Paso 1 Solicitar el código

- Título «Recuperar contraseña» y explicación breve: «Ingresá el correo de tu cuenta para solicitar un código».
- Campo «Correo», `type=email`, `autocomplete=email`, obligatorio, longitud máxima 254. Quitar espacios exteriores al enviar; no intentar averiguar si el correo está registrado.
- Acción principal «Enviar código». Mientras espera: indicador de carga y bloqueo de envíos repetidos.
- Acción secundaria «Volver a ingresar» hacia `/ingresar`.
- Después de `202`, mostrar el mensaje neutro del contrato y pasar al formulario del código. No mostrar «Cuenta encontrada» ni «Correo entregado».

### Paso 2 Código y contraseña nueva

- Mostrar el correo ingresado por la propia persona y «Cambiar correo». Este dato no implica que la cuenta exista.
- Campo «Código de seis dígitos»: texto, `inputMode=numeric`, `autocomplete=one-time-code`, patrón de seis dígitos y longitud máxima seis. Mantener ceros iniciales; permitir pegar el código completo. No usar `type=number`.
- Campos «Contraseña nueva» y «Repetir contraseña», `autocomplete=new-password`. Mostrar requisitos y permitir mostrar u ocultar ambos con controles accesibles. No copiar el código OTP en esos campos ni recortar la contraseña.
- Acción «Guardar contraseña». Requiere OTP con formato correcto, política de contraseña y coincidencia; validar localmente sin sustituir la validación del backend.
- Acción «Reenviar código». Tras una solicitud aceptada, esperar sesenta segundos por defecto para ofrecerla; si hay `429`, sustituir el contador por el tiempo informado por el servidor. El máximo por hora siempre lo decide el backend.
- Texto «El código vence a los diez minutos» referido al valor predeterminado. Si el backend cambia su vigencia, actualizar ese texto coordinadamente; no simular que el cliente conoce un vencimiento absoluto que el endpoint no devuelve.
- Al reenviar correctamente, borrar OTP y contraseñas introducidas y aclarar «Usá el último código que recibas». No reenviar ni confirmar automáticamente.

### Paso 3 Confirmación

- Después de `204`: «Tu contraseña se actualizó. Volvé a ingresar con la nueva contraseña».
- Borrar código y contraseñas de la memoria del formulario, eliminar la sesión local y actualizar el estado de autenticación sin volver a cargar información con un token revocado. No crear un token de reemplazo.
- Acción «Ir a ingresar» hacia `/ingresar`; sin redirección automática inesperada. Puede conservarse el correo solo en memoria para facilitar ese login, nunca la contraseña.
- Si la persona abandona el recorrido o recarga, el formulario vuelve a solicitar correo. No disparar un nuevo correo al montar la página. El código ya enviado sigue sujeto al servidor; la persona puede reingresar su correo y elegir «Ya tengo un código» para acceder al paso 2 sin enviar otro.

## 4 Contrato compartido con el frontend

Esta sección debe permanecer idéntica en ambos SPEC. Es la fuente acordada para implementar la integración; distingue los valores predeterminados de los valores que eventualmente configure el servidor.

### Solicitar o reenviar

`POST /api/auth/password-reset/request` sin requerir JWT.

```json
{ "email": "persona@example.com" }
```

- Correo obligatorio, sin espacios exteriores y de hasta 254 caracteres. El backend normaliza y valida; no se consulta previamente si existe.
- Respuesta válida: `202 Accepted`, sin cuerpo, para una cuenta activa, inexistente, suspendida o eliminada. Solo una cuenta activa recibe el correo.
- Mensaje del cliente: «Si hay una cuenta activa con ese correo, vas a recibir un código para recuperar el acceso».
- El reenvío utiliza este mismo endpoint. Una nueva solicitud aceptada sustituye cualquier código anterior para ese correo; solo el más reciente puede confirmar.
- No devolver código, existencia de cuenta, token de sesión ni identidad del usuario.

### Confirmar el cambio

`POST /api/auth/password-reset/confirm` sin requerir JWT.

```json
{
  "email": "persona@example.com",
  "code": "012345",
  "newPassword": "Ejemplo!482"
}
```

- `code` es un string de exactamente seis dígitos ASCII; conserva ceros iniciales.
- La contraseña cumple la política compartida actual: al menos ocho caracteres, una letra ASCII, un número y un carácter especial. No se recorta ni se transforma. El backend es la autoridad de validación.
- La confirmación de contraseña es una validación del frontend: no se envía otro campo al backend.
- Éxito: `204 No Content`, sin JWT ni cuerpo. El cliente limpia los datos sensibles y muestra un acceso a `/ingresar`; no inicia sesión automáticamente.
- Predeterminados: código válido durante diez minutos, máximo cinco intentos fallidos por código, espera de sesenta segundos entre solicitudes y máximo tres solicitudes aceptadas por correo en una ventana móvil de una hora. El servidor aplica los valores efectivos.
- Un código se usa una sola vez, únicamente para su correo y para recuperar contraseña. Un intento fallido consume presupuesto aunque termine en una respuesta HTTP de error.

### Errores

Formato JSON existente; campos opcionales ausentes si no corresponden:

```json
{
  "code": "DEMASIADAS_SOLICITUDES",
  "message": "Hiciste demasiadas solicitudes. Esperá un momento e intentá de nuevo.",
  "requestId": "identificador-de-soporte",
  "retryAfterSeconds": 60
}
```

| Estado | Código | Comportamiento del cliente |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Corregir correo, código o contraseña; mantener el paso actual. |
| `400` | `OTP_INVALIDO` | Indicar código incorrecto o no utilizable, sin revelar la cuenta. Puede incluir `intentosRestantes`. |
| `400` | `OTP_EXPIRADO` | Indicar vencimiento y ofrecer solicitar otro código. |
| `400` | `OTP_AGOTADO` | Deshabilitar la confirmación de ese código y ofrecer reenvío cuando corresponda. |
| `429` | `DEMASIADAS_SOLICITUDES` | Respetar `retryAfterSeconds` o `Retry-After`; no reintentar automáticamente. |
| `5xx` o red | Sin depender de un código específico | Mostrar error recuperable y permitir reintento manual. No afirmar que el correo fue entregado. |

El backend emite `Retry-After` en segundos cuando responde un límite. El frontend no debe asumir que el contador visual sustituye el control del servidor. Los códigos OTP de error no indican si existe una cuenta: también pueden aplicarse a una solicitud sintética de un correo sin cuenta activa.

## 5 Requisitos de integración y estado

- **FE-01:** Añadir métodos tipados equivalentes a `requestPasswordReset(email): Promise<void>` y `confirmPasswordReset({ email, code, newPassword }): Promise<void>`, utilizando el cliente común y `VITE_API_URL` ya existente. No fijar una dirección local o de Dokploy en el componente.
- **FE-02:** Aceptar `202` y `204` sin intentar parsear JSON inexistente como si fuera un error. No exigir un JWT válido ni usar el modo de datos de demostración para fingir un cambio de contraseña remoto.
- **FE-03:** Extender `ApiError` de forma compatible con llamadas existentes para conservar `retryAfterSeconds`, `intentosRestantes` y, si se utiliza para soporte, `requestId`. Obtener espera del JSON y como respaldo de `Retry-After`; si ambos faltan o son inválidos, usar sesenta segundos solo como ayuda visual.
- **FE-04:** El contador usa una fecha límite local y se recalcula al volver a la pestaña; no depende de que cada segundo de `setInterval` se ejecute. Una recarga puede borrar el contador local, pero no el límite del servidor. No cambiarlo por parámetros arbitrarios del usuario.
- **FE-05:** Distinguir estados inicial, solicitando, completando datos, reenviando, confirmando, éxito y error. Un único envío activo por operación; no permitir reenvío y confirmación simultáneos.
- **FE-06:** «Cambiar correo» limpia OTP, contraseñas y errores del paso anterior. Ignorar o cancelar respuestas pendientes para que una respuesta del correo previo no modifique el nuevo formulario. Limpiar temporizadores al abandonar la página.
- **FE-07:** Errores `OTP_INVALIDO` permiten corregir el código. `OTP_EXPIRADO` y `OTP_AGOTADO` deshabilitan confirmación para ese desafío hasta un reenvío aceptado o un nuevo ingreso al flujo; cambiar texto del código no evita el estado agotado. Si `intentosRestantes` es cero, ofrecer recuperación sin depender de recibir primero otro error.
- **FE-08:** Un error de red al confirmar tiene resultado incierto: el servidor pudo cambiar la contraseña. Mostrar «No pudimos confirmar el resultado. Podés intentar ingresar con la contraseña nueva o solicitar otro código» y ofrecer esas acciones. No decir categóricamente que el cambio falló ni repetir la petición automáticamente.
- **FE-09:** No enviar `newPasswordConfirmation`, IDs, rol ni tokens de Firebase en las solicitudes. No añadir OTP, contraseña o correo a analytics, registros de consola o mensajes técnicos visibles. El OTP y las contraseñas permanecen solo en memoria; tampoco se guardan en `localStorage` o `sessionStorage`.
- **FE-10:** Tras el éxito, limpiar sesión del contexto y token `trama-token` por el mecanismo compartido del proyecto, sin borrar claves de otras aplicaciones. Si el almacenamiento falla, no afirmar que la sesión local se cerró: mostrar una instrucción recuperable y no reutilizar el token en memoria. Coordinar pestañas por el mecanismo de sesión disponible, sin publicar datos sensibles entre ellas.

## 6 Diseño y accesibilidad

Reutilizar `auth-page`, `auth-header`, `auth-grid`, `auth-form`, `form-stack`, la tipografía, los espaciados y componentes de acceso. Usar la misma cabecera y marca; evitar controles flotantes superpuestos a campos y mensajes. El diseño debe adaptarse a 320 píxeles de ancho sin desplazamiento horizontal ni pérdida de acciones.

Cada campo tiene etiqueta visible y errores asociados mediante `aria-describedby`; aplicar `aria-invalid` cuando corresponda. Al cambiar de paso, mover foco al título o primer campo apropiado. Anunciar errores y éxito mediante una región accesible sin anunciar cada segundo del contador. Los controles de mostrar contraseña usan `type=button`, nombre accesible y estado reconocible; Enter envía solo el formulario del paso actual.

Usar un solo campo OTP para permitir pegado, autocompletado y navegación simple. No depender exclusivamente del color para estado, validez o espera. Conservar acciones utilizables con teclado, zoom del 200 % y pantalla móvil. Probar foco de error, carga, reenvío y finalización.

## 7 Casos de aceptación

| Caso | Resultado esperado |
| --- | --- |
| Acceso desde login o URL directa | `/recuperar` abre sin sesión y sin hacer solicitudes por sí sola. |
| Correo válido y `202` vacío | Pasa al código con mensaje neutro; no muestra datos obtenidos de la cuenta. |
| Correo inválido | Error claro, sin envío; admite corregirlo. |
| Ya tengo un código | Permite confirmar con correo y código existentes, sin reenviar al entrar. |
| OTP con cero inicial | Se envía exactamente como seis caracteres de texto. |
| Contraseña débil o confirmación diferente | No envía confirmación; explica el requisito pertinente. |
| Código inválido | Mantiene el correo y permite corregir el OTP; muestra intentos si están disponibles. |
| Código vencido o agotado | Ofrece nuevo código y respeta el límite; no afirma que la cuenta no existe. |
| Reenvío correcto | Borra los valores sensibles y solicita usar el último código. |
| `429` | Se muestra la espera efectiva; no se generan reintentos automáticos. |
| Doble clic o respuestas fuera de orden | No duplica envíos ni aplica estado de otro correo. |
| Red perdida tras confirmar | Resultado incierto con acceso a login o nuevo código. |
| Confirmación `204` | Limpia datos y sesión; muestra éxito sin login automático. |
| Recarga o navegación hacia atrás | No restaura contraseña/OTP ni reenvía correos automáticamente. |
| Móvil y teclado | No hay superposición, foco atrapado ni acciones inaccesibles. |

## 8 Pruebas y entrega

Crear pruebas de integración del componente con Vitest y Testing Library y pruebas del adaptador HTTP con respuestas vacías y metadatos. Usar temporizadores controlados para cooldown, una respuesta retardada para cambio de correo y un error de red tras confirmación para resultado incierto. Verificar que no se escriben código o contraseña en almacenamiento ni en URL. Una prueba simulada debe fallar con el placeholder actual y pasar con el recorrido implementado.

Ejecutar las pruebas focalizadas, `npm run build` y lint sobre los archivos afectados. Revisar en navegador escritorio y móvil los pasos, foco, mensajes, controles y cargas. No se requiere repetir una batería completa sin motivo ni afirmar que un mock representa correo entregado.

Prueba conjunta de cierre en testing: usar buzón controlado, solicitar desde la pantalla, recibir el mensaje real, confirmar, comprobar rechazo de contraseña anterior e ingreso con nueva, repetir un OTP usado y comprobar que una sesión anterior es rechazada por API. Las cuentas `example.com` de pruebas no permiten acreditar recepción SMTP real. No usar logs con OTP como sustituto de entrega al usuario.

## 9 Dependencias y orden de implementación

1. Validar con backend el contrato compartido, SMTP y las brechas descritas en su SPEC. No habilitar un flujo que promete recuperación si el servicio solo escribe códigos en logs.
2. Incorporar métodos tipados y metadatos de error en el adaptador común, con sus pruebas.
3. Sustituir `RecoveryPage`, reutilizar diseño existente e implementar estados, limpieza y accesibilidad.
4. Ejecutar pruebas focalizadas y recorrido conjunto en testing; documentar resultados, correo recibido y límites pendientes sin secretos.

El backend es responsable de caducidad, intentos, sustitución, cambio de contraseña y revocación. El frontend nunca decide que un OTP es válido por comparación local. SMTP, variables de correo, migraciones y correcciones de Push por revocación son dependencias de los servicios correspondientes, no secretos que deba cargar el cliente.

El entorno objetivo es testing, construido desde `dev`.

## 10 Referencias

- Código actual de `App.tsx`, `pages/Access.tsx`, `data/api.ts` y las políticas de interfaz del repositorio.
- Contrato vigente de `AccountRecoveryController`, `PasswordResetConfirmRequest`, `PasswordPolicy` y `ErrorResponse` de API.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), consultado el 19 de noviembre de 2026: referencia de seguridad compartida con el backend. Las decisiones de interfaz y valores numéricos pertenecen a este proyecto.
