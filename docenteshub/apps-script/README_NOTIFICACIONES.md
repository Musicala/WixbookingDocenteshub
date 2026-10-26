# Notificaciones por correo para Registro de jornada

Este proyecto usa un Web App de Google Apps Script para enviar el correo de forma segura. El navegador solo llama un webhook; el correo lo envia Apps Script desde la cuenta que despliega el proyecto.

## Pasos de configuracion

1. Entra a Google Apps Script usando la cuenta `imusicaladocente@gmail.com`.
2. Crea un proyecto nuevo.
3. Copia el contenido de `apps-script/Code.gs` y pegalo en el archivo `Code.gs` del proyecto de Apps Script.
4. Guarda el proyecto.
5. En el selector de funciones, elige `testEmail`.
6. Ejecuta `testEmail` para autorizar los permisos de envio de correo.
7. Revisa que llegue un correo de prueba a `notificaciones.musicala@gmail.com`.
8. Ve a `Implementar` > `Nueva implementacion`.
9. Selecciona tipo `Aplicacion web`.
10. Configura:
   - Ejecutar como: `Yo`
   - Quien tiene acceso: `Cualquier persona` / `Anyone`
11. Haz clic en `Implementar`.
12. Copia la URL del Web App que termina en `/exec`.
13. En `app.js`, pega esa URL en:

```js
const TEACHER_SHIFT_EMAIL_WEBHOOK_URL = "";
```

Debe quedar asi:

```js
const TEACHER_SHIFT_EMAIL_WEBHOOK_URL = "https://script.google.com/macros/s/...";
```

14. Vuelve a subir o publicar la app web del HUB Docentes Musicala.

## Prueba recomendada

1. Inicia sesion como docente.
2. Abre `Registro de jornada`.
3. Registra un inicio:
   - En sede: escanea el QR valido `ADM-LLEGADA`.
   - En hogar: marca `Ya llegue a la ubicacion de la clase`.
   - En virtual: marca `Ya me conecte`.
4. Verifica que el registro siga guardandose en Firestore en `teacherClassStartRecords`.
5. Verifica que llegue un correo a `notificaciones.musicala@gmail.com`.

Si `TEACHER_SHIFT_EMAIL_WEBHOOK_URL` queda vacia o el Web App falla, el registro en Firestore debe seguir funcionando. El docente no vera un error por correo; solo quedara un `console.warn` en la consola del navegador.
