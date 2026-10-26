# Cambios implementados

## 1. Bitácora académica unificada
- Se dejó un solo botón en el HUB: **Bitácora Académica**.
- Se eliminó la duplicación visual entre “Bitácora tareas académicas” y “Bitácora Académica / Trabajo por objetivos”.
- El botón abre el módulo interno `modules/bitacora-academica/`.

## 2. Diferenciación entre tareas académicas y bolsa de horas
Dentro de la misma sección ahora existen dos tipos de tarea:

- **Tarea académica de jornada**: para trabajos que se realizan dentro de la jornada normal cuando no hay clase o queda tiempo disponible.
- **Trabajo por bolsa de horas**: para horas extra, reposiciones o trabajo por objetivos acordado.

El campo que diferencia esto en Firestore es:

```js
workScope: "academica" // tarea de jornada
workScope: "bolsa"     // bolsa de horas
```

## 3. Asignación por docente desde admin
- En modo admin, al crear una tarea se puede seleccionar la docente responsable.
- En modo admin, al crear o editar una bolsa de horas se puede seleccionar la docente.
- En modo docente, el módulo solo carga la información del usuario autenticado.
- Los documentos académicos guardan `teacherEmail`, `teacherName` y `person`.

## 4. Seguimiento por parte del docente
- El docente puede abrir una tarea, registrar avance y actualizar el estado.
- Las tareas de bolsa muestran horas estimadas/usadas.
- Las tareas académicas de jornada se muestran como seguimiento diario, sin forzar “0 horas” como si fueran una bolsa.

## 5. Cierre automático de jornadas sin cierre manual
- Si una jornada queda abierta y ya cambió el día en Bogotá, el sistema la cierra automáticamente.
- Usa la hora final configurada en el horario del docente cuando existe.
- Si no existe horario configurado, usa `23:59`.
- Marca el registro como:

```js
autoClosed: true
missingManualClose: true
autoCloseReason: "sin_cierre_al_finalizar_dia"
source: "auto_cierre"
```

Esto evita que una jornada quede abierta indefinidamente.

## 6. Gestión de docentes desde el front
- El panel admin guarda docentes en `hubUsers`.
- Después de guardar, el front vuelve a leer el documento desde Firestore para verificar que sí quedó persistido.
- La lista de docentes del panel admin combina usuarios base del código + docentes creados desde `hubUsers`.
- Los filtros y selectores usan esta lista combinada.

## 7. Reglas de Firestore actualizadas
El archivo `firestore.rules` incluye permisos para:

- Cierre automático de jornadas.
- Lectura de horarios propios por docente.
- Escritura/listado admin de horarios y overrides.
- Gestión admin de docentes en `hubUsers`.
- Asignación admin de tareas académicas y bolsa de horas.

Después de subir el sitio, también hay que publicar las reglas en Firebase.
