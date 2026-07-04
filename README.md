# Wix Booking · Docentes Hub

Integración entre **Wix Bookings** y el **Hub de Docentes de Musicala**. Recibe las reservas de clases desde Wix vía webhook, las guarda en Firestore y las muestra en un calendario web con asignación de salones, vinculación de docentes y avisos de novedades.

## Arquitectura

- **`functions/`** — Cloud Function `wixBookingWebhook` (Firebase Functions v2, Node 22). Recibe los eventos de Wix Automations (creación, actualización, reagendamiento, cancelación), normaliza el payload y lo escribe en la colección `calendarioWix` de Firestore. Incluye deduplicación por hash, reconciliación de reagendamientos y auto-vinculación de docentes.
- **`index.html`** — Página del calendario (hosting de Firebase). Carga los módulos desde `js/` y `css/`.
- **`js/reservas-calendar.js`** — Lógica del calendario: vistas por semana/mes, filtros admin, asignación de salones (manual y **relleno automático**), vinculación de docentes y **aviso de novedades** por docente.
- **`css/reservas-calendar.css`** — Estilos del calendario.
- **`firestore.rules`** — Reglas de seguridad (admins vs. docentes por `staffEmail`).
- **`firestore.indexes.json`** — Índices compuestos (p. ej. `staffEmail` + `startDate` para la vista docente).

> `reservas-calendar.js` / `.css` en la raíz son la fuente de edición; se copian a `js/` y `css/` (que es lo que `index.html` carga) antes de desplegar.

## Configuración

La Cloud Function usa un secreto para validar el webhook. **No está en el repo** (ver `.gitignore`). Para configurarlo:

```bash
# Local (functions/.env, ignorado por git):
#   WIX_WEBHOOK_SECRET=<tu-secreto>

firebase functions:secrets:set WIX_WEBHOOK_SECRET
```

## Despliegue

```bash
# Instalar dependencias de las funciones
cd functions && npm install && cd ..

# Desplegar todo
firebase deploy

# O por partes
firebase deploy --only functions:wixBookingWebhook
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

## Webhook

Wix Automations envía un POST a la URL de la función con el secreto como query param:

```
https://us-central1-<proyecto>.cloudfunctions.net/wixBookingWebhook?secret=<SECRETO>&status=<created|updated|cancelled>
```

## Proyecto Firebase

`musicala-docentes-hub` (ver `.firebaserc`).
