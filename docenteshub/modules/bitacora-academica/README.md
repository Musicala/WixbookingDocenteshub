# Módulo: Bitácora Académica

Módulo interno del **HUB Docentes Musicala**. Es una sola sección para dos flujos distintos:

1. **Tareas académicas de jornada**: tareas que la coordinación asigna para realizar durante la jornada cuando no hay clase o cuando queda tiempo académico disponible.
2. **Bolsa de horas**: horas asignadas de forma puntual para trabajo extra, reposición de horas o trabajo por objetivos acordado.

Toda la información se guarda en **Firebase/Firestore**. No usa Google Sheets ni localStorage para los registros principales.

## Cómo lo abre el HUB
El HUB tiene un único botón **"Bitácora Académica"** en la sección *Gestión docente*. Ya no debe existir un botón separado para "Trabajo por objetivos".

El HUB abre este módulo en un overlay con `iframe`, pasando contexto por la URL:

```txt
modules/bitacora-academica/index.html?email=<correo>&name=<nombre>&role=<docente|admin>&embedded=1
```

Como el `iframe` es del **mismo origen** que el HUB, reutiliza la sesión de Firebase Auth ya iniciada. El botón **"Volver al HUB"** envía `postMessage({type:'closeAcademicModule'})` a la ventana padre para cerrar el overlay.

## Persistencia en Firestore
| Colección              | Contenido |
|------------------------|----------|
| `academicObjectives`   | Tareas académicas y tareas de bolsa. Se diferencian con `workScope: "academica"` o `workScope: "bolsa"`. |
| `academicTaskBudgets`  | Bolsas de horas por periodo y docente. |
| `academicTaskHourLogs` | Seguimientos / avances registrados por la docente. |
| `hubUsers`             | Docentes gestionados desde el panel admin del HUB. |

Cada documento académico lleva `teacherEmail` y `teacherName`. Las reglas de Firestore garantizan que cada docente solo vea/escriba lo suyo y que coordinación admin pueda gestionar todo.

> Importante: las reglas de `firestore.rules` deben publicarse aparte en Firebase Console → Firestore → Rules → Publicar. Si no se publican, Firebase hará su encantador numerito de “no tengo permisos” y nada se guardará.

## Roles
- **Docente** (`role=docente`): ve solo sus tareas, su bolsa y sus seguimientos. Puede registrar avances y cambiar estado.
- **Coordinación** (`role=admin`): ve todas las docentes, puede asignar tareas a una docente específica y configurar bolsas de horas.

## Gestión de docentes desde el HUB
Los docentes nuevos se agregan desde el panel admin en la colección `hubUsers`. El guardado ahora se verifica inmediatamente leyendo de nuevo el documento creado/actualizado, para evitar que el front muestre éxito cuando Firestore no guardó nada.

## Cierre automático de jornada
Si una jornada queda abierta y cambia el día en Bogotá, el HUB la cierra automáticamente como **sin cierre manual**:

- Usa la hora de salida del horario configurado del docente si existe.
- Si no hay hora configurada, usa `23:59`.
- Crea un registro en `teacherClassStartRecords` con `autoClosed: true` y `missingManualClose: true`.
- Cierra `teacherOpenShiftSessions` para que no quede una jornada abierta eternamente, porque la humanidad ya tiene suficientes pendientes.

## Archivos principales
- `index.html` — interfaz del módulo académico.
- `styles.css` — estilos del módulo.
- `script.js` — Firebase, carga de docentes, tareas, bolsa y seguimientos.
- `../../app.js` — botón único del HUB, panel admin, jornada y cierre automático.
- `../../firestore.rules` — permisos necesarios para los nuevos flujos.
