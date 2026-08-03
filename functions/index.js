/* ============================================================
   Cloud Function: wixBookingWebhook
   Proyecto: musicala-docentes-hub
   ============================================================
   Recibe reservas de Wix Automations vía HTTP POST,
   las normaliza y las guarda en Firestore (calendarioWix).

   Despliegue:
     firebase functions:secrets:set WIX_WEBHOOK_SECRET
     firebase deploy --only functions:wixBookingWebhook

   Prueba local (PowerShell):
     Ver sección "Pruebas" al final de este archivo.
   ============================================================ */

"use strict";

const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

/* Solo inicializar si no se inicializó antes (evita error en hot-reload) */
if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({
  region: "us-central1",
  maxInstances: 3,
});

/* ======================== Utilidades ======================== */

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function firstEmail(...values) {
  return normalizeEmail(firstText(...values));
}

function firstArrayValue(value) {
  return Array.isArray(value) && value.length ? value[0] : "";
}

function joinName(firstName, lastName) {
  return [cleanText(firstName), cleanText(lastName)].filter(Boolean).join(" ").trim();
}

function uniqueEmails(values) {
  return [...new Set(
    values
      .flat()
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  )];
}

/* Clave normalizada del nombre de docente (igual que el front-end:
   normalizeStaffKey en reservas-calendar.js). Se usa como id en
   wixStaffMap y wixStaffUnmatched para vincular por nombre. */
function normalizeStaffKey(name) {
  return cleanText(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unwrapWixPayload(body) {
  if (!body || typeof body !== "object") return {};

  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data;
  }

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (error) {
      console.warn("No se pudo parsear body.data como JSON", {
        message: error.message,
        preview: data.slice(0, 200),
      });
    }
  }

  return body;
}

function makeHash(data) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
}

function normalizeStatus(status) {
  const value = cleanText(status).toLowerCase();

  if (["cancelled", "canceled", "cancelada", "cancelado", "declined"].includes(value)) {
    return "cancelled";
  }
  if (["rescheduled", "reagendada", "reagendado"].includes(value)) {
    return "rescheduled";
  }
  if (["updated", "actualizada", "actualizado"].includes(value)) {
    return "updated";
  }
  if (["pending", "pendiente", "pending_approval", "waiting_list"].includes(value)) {
    return "pending";
  }
  return value || "confirmed";
}

function isCancellationPayload(payload) {
  const status = normalizeStatus(payload.status || payload.booking_status);
  return status === "cancelled" ||
    Boolean(firstText(
      payload.canceled_timestamp_with_timezone,
      payload.cancelled_timestamp_with_timezone,
      payload.canceledTimestamp,
      payload.cancelledTimestamp,
      payload.cancellation_date,
      payload.cancelled_date,
      payload.canceled_date
    ));
}

function isReschedulePayload(payload) {
  const status = normalizeStatus(payload.status || payload.booking_status);
  return status === "rescheduled" ||
    Boolean(firstText(
      payload.rescheduled_timestamp_with_timezone,
      payload.reschedule_timestamp_with_timezone,
      payload.rescheduledTimestamp,
      payload.rescheduleTimestamp,
      payload.rescheduling_date,
      payload.rescheduled_date
    ));
}

function isUpdatePayload(payload) {
  const status = normalizeStatus(payload.status || payload.booking_status);
  return status === "updated" ||
    Boolean(firstText(
      payload.updated_timestamp_with_timezone,
      payload.update_timestamp_with_timezone,
      payload.booking_updated_timestamp,
      payload.booking_updated_date,
      payload.updatedDate,
      payload.updated_date
    ));
}

function getForcedStatus(req, payload) {
  const forced = firstText(
    req.query && req.query.status,
    req.query && req.query.event,
    req.query && req.query.action,
    req.query && req.query.type,
    payload.webhookStatus,
    payload.webhook_status
  );
  return forced ? normalizeStatus(forced) : "";
}

function parseDate(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const date = /^\d+$/.test(raw) ? new Date(Number(raw)) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return admin.firestore.Timestamp.fromDate(date);
}

function parseWixTimestampWithTimezone(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const firstPart = raw.split(/\s+/)[0];
  return parseDate(firstPart || raw);
}

/* =================== Normalización del payload ============== */

function normalizeBooking(payload) {
  /* bookingId: priorizar campos más específicos */
  const bookingId =
    cleanText(payload.bookingId) ||
    cleanText(payload.booking_id) ||
    cleanText(payload.id) ||
    cleanText(payload.wixBookingId) ||
    cleanText(payload.instance_id) ||
    cleanText(payload.order_id);

  const contact = payload.contact || {};
  const contactName = contact.name || {};
  const studentFirstName = firstText(payload.customerFirstName, payload.booking_contact_first_name, contactName.first);
  const studentLastName = firstText(payload.customerLastName, payload.booking_contact_last_name, contactName.last);
  const customerName = firstText(
    payload.customerName,
    payload.bookingContactName,
    payload.booking_contact_name,
    joinName(studentFirstName, studentLastName),
    contact.name && typeof contact.name === "string" ? contact.name : ""
  );
  const studentEmails = uniqueEmails([
    payload.studentEmails,
    payload.customerEmails,
    payload.participantEmails,
    payload.customerEmail,
    payload.booking_contact_email,
    contact.email,
  ]);
  const customerEmail = firstEmail(payload.customerEmail, payload.booking_contact_email, contact.email, firstArrayValue(studentEmails));
  const staffEmail = firstEmail(
    payload.staffEmail,
    payload.staff_member_email,
    payload.staff_members_emails,
    firstArrayValue(payload.staff_members_emails)
  );
  const staffName = firstText(
    payload.staffName,
    payload.staff_member_name,
    payload.staff_member_name_main_language,
    firstArrayValue(payload.staff_member_names),
    firstArrayValue(payload.staff_members_name_main_language)
  );
  const serviceName = firstText(payload.serviceName, payload.service_name, payload.service_name_main_language);
  const startDateRaw = firstText(
    payload.startDate,
    payload.start_date,
    payload.start_date_by_business_tz,
    payload.start_time_timestamp_with_timezone,
    payload.start_time_timestamp
  );
  const endDateRaw = firstText(payload.endDate, payload.end_date);
  /* Fecha anterior en reagendamientos/actualizaciones: Wix reagenda creando
     una reserva NUEVA (con booking_id nuevo) y envía la fecha vieja aquí.
     La usamos para localizar y retirar la reserva original del horario viejo. */
  const previousStartDateRaw = firstText(
    payload.previous_start_date,
    payload.previousStartDate,
    payload.old_start_date,
    payload.previous_start_date_by_business_tz
  );
  const location = firstText(payload.location, payload.location_main_language, payload.primary_resource_name);
  const cancelledAtRaw = firstText(
    payload.canceled_timestamp_with_timezone,
    payload.cancelled_timestamp_with_timezone,
    payload.canceledTimestamp,
    payload.cancelledTimestamp,
    payload.cancellation_date,
    payload.cancelled_date,
    payload.canceled_date
  );
  const updatedAtRaw = firstText(
    payload.updated_timestamp_with_timezone,
    payload.update_timestamp_with_timezone,
    payload.booking_updated_timestamp,
    payload.booking_updated_date,
    payload.updatedDate,
    payload.updated_date
  );
  const rescheduledAtRaw = firstText(
    payload.rescheduled_timestamp_with_timezone,
    payload.reschedule_timestamp_with_timezone,
    payload.rescheduledTimestamp,
    payload.rescheduleTimestamp,
    payload.rescheduling_date,
    payload.rescheduled_date
  );
  const status = isCancellationPayload(payload)
    ? "cancelled"
    : isReschedulePayload(payload)
      ? "rescheduled"
      : isUpdatePayload(payload)
        ? "updated"
    : normalizeStatus(payload.status || payload.booking_status);
  const participantsCount = Number(
    payload.participantsCount ||
    payload.participants ||
    payload.number_of_participants ||
    1
  );

  /* Fallback: hash de campos clave para identificar la reserva sin ID */
  const fallbackHash = makeHash({
    serviceName,
    staffEmail,
    staffName,
    customerEmail,
    customerName,
    startDate: startDateRaw,
    endDate: endDateRaw,
  });

  const finalBookingId = bookingId || `fallback_${fallbackHash}`;

  return {
    bookingId: finalBookingId,

    serviceName,
    serviceId: cleanText(payload.serviceId) || cleanText(payload.service_id),
    serviceType: cleanText(payload.serviceType) || cleanText(payload.service_type),

    staffName,
    staffEmail,

    customerName,
    customerEmail,
    customerPhone: firstText(payload.customerPhone, payload.booking_contact_phone, contact.phone),
    studentEmails,
    studentLookupKey: customerEmail || studentEmails[0] || "",

    startDate:    parseDate(startDateRaw),
    endDate:      parseDate(endDateRaw),
    startDateRaw,
    endDateRaw,
    previousStartDate:    parseDate(previousStartDateRaw),
    previousStartDateRaw,

    status,
    cancelledAt: parseWixTimestampWithTimezone(cancelledAtRaw),
    cancelledAtRaw,
    wixUpdatedAt: parseWixTimestampWithTimezone(updatedAtRaw),
    wixUpdatedAtRaw: updatedAtRaw,
    rescheduledAt: parseWixTimestampWithTimezone(rescheduledAtRaw),
    rescheduledAtRaw,
    location,
    locationId: cleanText(payload.locationId) || cleanText(payload.location_id),
    modality: firstText(payload.modality, payload.online_conference_enabled ? "Virtual" : "", payload.online_conference_url ? "Virtual" : ""),
    notes:    firstText(payload.notes, payload.staff_member_message, payload.online_conference_description),

    participantsCount,
    manageBookingUrl: cleanText(payload.manage_booking_link),
    cancellationUrl: cleanText(payload.cancellation_link),
    reschedulingUrl: cleanText(payload.rescheduling_link),
    onlineConferenceUrl: cleanText(payload.online_conference_url),

    source: "wix",

    /* Payload original para depuración (no se muestra en el Hub) */
    rawPayload: payload,
  };
}

/* ================= Sincronización activa con Wix ================
   Complementa el webhook: coordinación puede pedir a Wix una lectura nueva
   cuando sospecha que una reserva no llegó. Las credenciales solo viven en
   Secret Manager; el navegador jamás recibe la API key. */
function wixApiBookingToPayload(item) {
  const booking = item.booking || item;
  /* Query Extended Bookings: los datos de clase viven en
     booking.bookedEntity.slot y los del estudiante en contactDetails. */
  const bookedEntity = booking.bookedEntity || item.bookedEntity || {};
  const slot = bookedEntity.slot || item.slot || booking.slot || {};
  const schedule = bookedEntity.schedule || item.schedule || booking.schedule || {};
  const session = slot.startDate ? slot : schedule;
  const participant = booking.contactDetails || item.contactDetails || item.participant || booking.participant || item.contact || booking.contact || {};
  const participantName = participant.name || {};
  const staff = slot.resource || item.resource || booking.resource || item.staffMember || booking.staffMember || {};
  const service = item.service || booking.service || {};
  const location = slot.location || schedule.location || item.location || booking.location || {};
  return {
    id: booking.id || item.id,
    status: booking.status || item.status,
    customerName: firstText(participant.fullName, participant.name && typeof participant.name === "string" ? participant.name : "", joinName(participant.firstName, participant.lastName), joinName(participantName.first, participantName.last)),
    customerEmail: firstText(participant.email, participant.emailAddress, booking.customerEmail),
    customerPhone: firstText(participant.phone, participant.phoneNumber),
    studentEmails: uniqueEmails([participant.email, participant.emailAddress, booking.customerEmail]),
    serviceName: firstText(booking.title, service.name, service.serviceName, session.serviceName, booking.serviceName),
    serviceId: firstText(slot.serviceId, schedule.serviceId, service.id, service._id, booking.serviceId),
    staffName: firstText(staff.name, staff.fullName, booking.staffName),
    staffEmail: firstText(staff.email, booking.staffEmail),
    startDate: firstText(slot.startDate, schedule.firstSessionStart, booking.startDate, booking.startTime),
    endDate: firstText(slot.endDate, schedule.lastSessionEnd, booking.endDate, booking.endTime),
    location: firstText(location.name, location.formattedAddress, booking.location),
    locationId: firstText(location.id, booking.locationId),
    modality: firstText(location.locationType, booking.modality),
    participantsCount: booking.totalParticipants || booking.participantsCount || item.participantsCount || 1,
    updatedDate: booking.updatedDate || item.updatedDate,
    createdDate: booking.createdDate || item.createdDate,
  };
}

/* La acción "Enviar solicitud HTTP" de Wix Automations puede envolver el
   resultado de la acción anterior de distintas maneras. Buscamos la lista
   sin depender de un solo nombre de campo para que el primer envío pueda ser
   "Toda la carga útil". */
function getWixAutomationBookings(...payloads) {
  const paths = [
    (value) => value,
    (value) => value && value.bookings,
    (value) => value && value.extendedBookings,
    (value) => value && value.data,
    (value) => value && value.data && value.data.bookings,
    (value) => value && value.data && value.data.extendedBookings,
    (value) => value && value.result,
    (value) => value && value.result && value.result.bookings,
    (value) => value && value.result && value.result.extendedBookings,
    (value) => value && value.output,
    (value) => value && value.output && value.output.bookings,
    (value) => value && value.output && value.output.extendedBookings,
  ];
  for (const payload of payloads) {
    for (const getValue of paths) {
      const candidate = getValue(payload);
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

async function saveWixAutomationBatch(db, items) {
  let batch = db.batch();
  let writes = 0;
  let imported = 0;
  const importedBookings = [];
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const item of items) {
    const booking = normalizeBooking(wixApiBookingToPayload(item));
    if (!booking.bookingId || !booking.startDate) continue;

    batch.set(db.collection("calendarioWix").doc(booking.bookingId), {
      ...booking,
      source: "wix-automation-sync",
      wixAutomationSyncedAt: now,
      updatedAt: now,
      receivedAt: now,
    }, { merge: true });
    writes += 1;
    imported += 1;
    importedBookings.push(booking);

    if (writes >= 400) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }
  if (writes) await batch.commit();

  /* La sincronizaciÃ³n masiva no pasa por el flujo del webhook individual.
     Cuando Wix reasigna una clase puede conservar la reserva anterior con otro
     ID, por lo que hay que retirar esa versiÃ³n tambiÃ©n aquÃ­. Excluimos las
     reservas que llegaron en este mismo lote: si Wix devuelve dos clases
     reales con el mismo grupo/horario, no las cancelamos por el orden en que
     fueron procesadas. */
  const incomingIds = new Set(importedBookings.map((booking) => booking.bookingId));
  let superseded = 0;
  for (const booking of importedBookings) {
    if (normalizeStatus(booking.status) === "cancelled") continue;
    const duplicates = await findDuplicateSlotBookings(db, booking);
    const staleDuplicates = duplicates.filter((doc) => !incomingIds.has(doc.id));
    if (!staleDuplicates.length) continue;

    const dedupeBatch = db.batch();
    staleDuplicates.forEach((doc) => {
      dedupeBatch.set(doc.ref, {
        status: "cancelled",
        supersededByBookingId: booking.bookingId,
        supersededAt: now,
        cancellationReceivedAt: now,
        updatedAt: now,
        dedupedBy: "wix-automation-sync",
      }, { merge: true });
    });
    await dedupeBatch.commit();
    superseded += staleDuplicates.length;
  }
  return { imported, superseded };
}

exports.syncWixBookings = onCall(
  { region: "us-central1", secrets: ["WIX_AUTOMATION_TRIGGER_URL"], timeoutSeconds: 60 },
  async (request) => {
    const caller = normalizeEmail(request.auth?.token?.email);
    if (!caller || !ADMIN_EMAILS.has(caller)) {
      throw new HttpsError("permission-denied", "Solo coordinación puede sincronizar con Wix.");
    }
    /* Ruta preferida: el Hub dispara la automatización de Wix, la cual
       consulta Bookings y devuelve el lote al webhook. No requiere API key. */
    const automationUrl = cleanText(process.env.WIX_AUTOMATION_TRIGGER_URL);
    if (!automationUrl) {
      throw new HttpsError("failed-precondition", "Falta configurar WIX_AUTOMATION_TRIGGER_URL en Firebase.");
    }
    const requestedAt = new Date();
    const defaultEnd = new Date(requestedAt.getTime() + (90 * 24 * 60 * 60 * 1000));
    const startDate = cleanText(request.data?.startDate) || requestedAt.toISOString();
    const endDate = cleanText(request.data?.endDate) || defaultEnd.toISOString();
    const automationResponse = await fetch(automationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
    });
    const automationResponseText = await automationResponse.text().catch(() => "");
    if (!automationResponse.ok) {
      console.error("Wix automation trigger failed", {
        status: automationResponse.status,
        response: automationResponseText.slice(0, 500),
      });
      throw new HttpsError("internal", `Wix no pudo iniciar la sincronización (${automationResponse.status}).`);
    }
    await admin.firestore().collection("calendarioWixSyncLogs").add({
      source: "wix-automation-trigger",
      startDate,
      endDate,
      requestedBy: caller,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, queued: true, startDate, endDate };

    /* Conservado como referencia de la integración directa anterior. */
    const apiKey = cleanText(process.env.WIX_API_KEY);
    const siteId = cleanText(process.env.WIX_SITE_ID);
    if (!apiKey || !siteId) {
      throw new HttpsError("failed-precondition", "Faltan los secretos WIX_API_KEY y WIX_SITE_ID en Firebase.");
    }

    const records = [];
    let cursor = "";
    // Wix entrega hasta 100 por página. Limitamos a 10 páginas por ejecución
    // para mantener la llamada del botón predecible (máximo 1.000 reservas).
    for (let page = 0; page < 10; page += 1) {
      const response = await fetch("https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: apiKey, "wix-site-id": siteId },
        body: JSON.stringify({ query: { cursorPaging: { limit: 100, ...(cursor ? { cursor } : {}) } }, withBookingAllowedActions: false }),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Wix API sync failed", response.status, responseBody);
        throw new HttpsError("internal", `Wix respondió ${response.status}. Revisa permisos de la API key.`);
      }
      records.push(...(responseBody.extendedBookings || responseBody.bookings || responseBody.items || []));
      cursor = responseBody.pagingMetadata?.cursors?.next || responseBody.nextCursor?.cursors?.next || "";
      if (!cursor) break;
    }
    const db = admin.firestore();
    let batch = db.batch();
    let writes = 0;
    let imported = 0;
    const now = admin.firestore.FieldValue.serverTimestamp();
    for (const item of records) {
      const normalized = normalizeBooking(wixApiBookingToPayload(item));
      if (!normalized.bookingId || !normalized.startDate) continue;
      batch.set(db.collection("calendarioWix").doc(normalized.bookingId), {
        ...normalized,
        source: "wix-api-sync",
        wixApiSyncedAt: now,
        wixApiSyncedBy: caller,
        rawWixApi: item,
        updatedAt: now,
      }, { merge: true });
      writes += 1;
      imported += 1;
      if (writes >= 400) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes) await batch.commit();
    await db.collection("calendarioWixSyncLogs").add({ source: "wix-api", imported, received: records.length, requestedBy: caller, createdAt: now });
    return { ok: true, imported, received: records.length };
  }
);

async function findMatchingActiveBookings(db, booking) {
  if (!booking.startDate || !booking.customerEmail || !booking.serviceName) return [];

  let query = db.collection("calendarioWix")
    .where("startDate", "==", booking.startDate)
    .where("customerEmail", "==", booking.customerEmail)
    .where("serviceName", "==", booking.serviceName);

  if (booking.staffEmail) {
    query = query.where("staffEmail", "==", booking.staffEmail);
  } else if (booking.staffName) {
    query = query.where("staffName", "==", booking.staffName);
  }

  const snap = await query.get();
  return snap.docs.filter((doc) => normalizeStatus(doc.data().status) !== "cancelled");
}

/* Localiza la reserva ORIGINAL que quedó en el horario anterior tras un
   reagendamiento/actualización. Wix crea una reserva nueva (booking_id nuevo)
   en la fecha nueva, así que la original —bajo otro id y en previousStartDate—
   nunca se toca y queda "fantasma" en el horario viejo. Consultamos solo por
   startDate (índice de un campo) y filtramos el resto en memoria para no exigir
   un índice compuesto. */
async function findSupersededBookings(db, booking) {
  if (!booking.previousStartDate) return [];

  const snap = await db.collection("calendarioWix")
    .where("startDate", "==", booking.previousStartDate)
    .get();

  return snap.docs.filter((doc) => {
    if (doc.id === booking.bookingId) return false;
    const data = doc.data();
    if (normalizeStatus(data.status) === "cancelled") return false;
    if (booking.serviceName && cleanText(data.serviceName) !== booking.serviceName) return false;
    if (booking.customerEmail && normalizeEmail(data.customerEmail) !== booking.customerEmail) return false;
    /* No comparar el docente: este método se invoca justamente cuando Wix
       reemplaza una reserva por otra (mismo estudiante/servicio/horario), y
       en una reasignación de docente el correo de la reserva anterior debe
       ser distinto. */
    return true;
  });
}

/* Identidad del grupo para deduplicar, independiente del docente. En un cambio
   de docente el conjunto de estudiantes (roster) NO cambia. Si Wix no manda
   correos, usamos el nombre del estudiante. No usamos la sede como respaldo:
   varias clases reales comparten sede y hora y no se deben borrar entre sí. */
function groupIdentity(data) {
  const roster = uniqueEmails([
    data.studentEmails,
    data.customerEmails,
    data.customerEmail,
  ]).sort().join(",");
  if (roster) return "r:" + roster;
  /* Algunos eventos de Wix no incluyen correo (sobre todo al editar una
     reserva). El nombre del estudiante sigue siendo suficiente para reconocer
     una sustitución y es más preciso que la sede compartida. */
  const customerName = cleanText(data.customerName).toLowerCase();
  if (customerName) return "n:" + customerName;
  return "";
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

/* Wix puede serializar la misma hora con segundos o milisegundos distintos
   entre la reserva anterior y la nueva. Comparamos por minuto. */
function slotMinute(value) {
  const ms = timestampMillis(value);
  return ms ? Math.floor(ms / 60000) : 0;
}

/* Deduplicación por horario: si llega una reserva (nueva o actualizada) y ya
   existen OTRAS activas en el MISMO horario para el mismo grupo,
   son duplicados y se marcan como superados. Caso típico: al cambiar el
   docente en Wix (sin cambiar la fecha), Wix emite un booking_id nuevo y la
   versión anterior —con el docente viejo— queda duplicada en el mismo horario.
   A propósito NO se filtra por docente, para atrapar justamente esos cambios.
   Wix puede cambiar el texto del servicio al reasignar, por lo que no se
   compara. Consulta una ventana pequeña de tiempo y filtra por la identidad
   segura del grupo. */
async function findDuplicateSlotBookings(db, booking) {
  if (!booking.startDate || !booking.serviceName) return [];
  const identity = groupIdentity(booking);
  const isExplicitUpdate = ["updated", "rescheduled"].includes(normalizeStatus(booking.status));
  /* En algunas actualizaciones Wix omite el correo del estudiante. Si el
     evento declara que es una actualización/reagendamiento, servicio y misma
     franja son un respaldo seguro para retirar la versión anterior, incluso
     cuando no podemos construir el roster. */
  if (!identity && !isExplicitUpdate) return [];

  const startMs = timestampMillis(booking.startDate);
  if (!startMs) return [];
  const snap = await db.collection("calendarioWix")
    .where("startDate", ">=", admin.firestore.Timestamp.fromMillis(startMs - 60000))
    .where("startDate", "<", admin.firestore.Timestamp.fromMillis(startMs + 60000))
    .get();

  return snap.docs.filter((doc) => {
    if (doc.id === booking.bookingId) return false;
    const d = doc.data();
    if (normalizeStatus(d.status) === "cancelled") return false;
    if (slotMinute(d.startDate) !== slotMinute(booking.startDate)) return false;
    if (identity && groupIdentity(d) === identity) return true;
    return isExplicitUpdate && cleanText(d.serviceName) === booking.serviceName;
  });
}

/* ==================== Cloud Function ======================= */

exports.wixBookingWebhook = onRequest(
  {
    cors: false,
  },
  async (req, res) => {
    try {
      const rawPayload = req.body || {};
      const payload = unwrapWixPayload(rawPayload);
      const receivedSecret =
        req.get("x-musicala-secret") ||
        rawPayload.secret ||
        payload.secret ||
        req.query.secret ||
        "";

      console.log("wixBookingWebhook request", {
        method: req.method,
        hasBody: Boolean(rawPayload && Object.keys(rawPayload).length),
        rawBodyKeys: rawPayload && typeof rawPayload === "object" ? Object.keys(rawPayload).slice(0, 40) : [],
        bodyKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 40) : [],
        dataType: rawPayload && rawPayload.data ? typeof rawPayload.data : "",
        queryKeys: req.query ? Object.keys(req.query) : [],
        hasSecret: Boolean(receivedSecret),
        contentType: req.get("content-type") || "",
        userAgent: req.get("user-agent") || "",
      });

      /* Wix puede hacer una validación GET/HEAD de la URL antes del POST real. */
      if (req.method === "GET" || req.method === "HEAD") {
        return res.status(200).json({
          ok: true,
          message: "Webhook activo. Envia eventos con POST.",
        });
      }

      /* Solo POST */
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed" });
      }

      if (receivedSecret !== process.env.WIX_WEBHOOK_SECRET) {
        console.warn("wixBookingWebhook unauthorized", {
          hasSecret: Boolean(receivedSecret),
          queryKeys: req.query ? Object.keys(req.query) : [],
          bodyKeys: payload && typeof payload === "object" ? Object.keys(payload).slice(0, 40) : [],
        });
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      /* Sincronización manual: la acción de Wix consulta un rango y envía
         todo el arreglo en un solo POST. Se guarda por bookingId, por lo que
         reenviar una página no duplica clases. */
      const automationBookings = getWixAutomationBookings(rawPayload, payload);
      if (automationBookings.length) {
        const db = admin.firestore();
        const sync = await saveWixAutomationBatch(db, automationBookings);
        await db.collection("calendarioWixSyncLogs").add({
          source: "wix-automation-http",
          received: automationBookings.length,
          imported: sync.imported,
          superseded: sync.superseded,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.status(200).json({
          ok: true,
          batch: true,
          received: automationBookings.length,
          imported: sync.imported,
          superseded: sync.superseded,
        });
      }

      const forcedStatus = getForcedStatus(req, payload);
      const payloadToNormalize = forcedStatus
        ? { ...payload, status: forcedStatus }
        : payload;

      /* Normalizar datos */
      const booking = normalizeBooking(payloadToNormalize);
      console.log("wixBookingWebhook normalized", {
        bookingId: booking.bookingId,
        serviceName: booking.serviceName,
        staffEmail: booking.staffEmail,
        customerEmail: booking.customerEmail,
        startDateRaw: booking.startDateRaw,
        hasStartDate: Boolean(booking.startDate),
        status: booking.status,
        forcedStatus,
      });

      if (!booking.bookingId) {
        return res.status(400).json({ ok: false, error: "Missing bookingId" });
      }

      const db  = admin.firestore();
      const ref = db.collection("calendarioWix").doc(booking.bookingId);

      /* Auto-vinculación: si Wix no manda el correo del docente pero ya existe
         un vínculo guardado (wixStaffMap) para ese nombre, lo aplicamos aquí.
         Así las reservas nuevas quedan vinculadas sin intervención manual. */
      const staffKey = normalizeStaffKey(booking.staffName);
      if (!booking.staffEmail && staffKey) {
        try {
          const mapSnap = await db.collection("wixStaffMap").doc(staffKey).get();
          const mapData = mapSnap.exists ? mapSnap.data() : null;
          if (mapData && mapData.enabled !== false && mapData.staffEmail) {
            booking.staffEmail = normalizeEmail(mapData.staffEmail);
            booking.staffLinkedFromName = booking.staffName;
          }
        } catch (mapError) {
          console.warn("No se pudo leer wixStaffMap", { staffKey, message: mapError.message });
        }
      }

      /* Hash del evento actual para detectar duplicados */
      const eventHash = makeHash({
        bookingId:         booking.bookingId,
        serviceName:       booking.serviceName,
        staffName:         booking.staffName,
        staffEmail:        booking.staffEmail,
        customerName:      booking.customerName,
        customerEmail:     booking.customerEmail,
        studentEmails:     booking.studentEmails,
        startDateRaw:      booking.startDateRaw,
        endDateRaw:        booking.endDateRaw,
        status:            booking.status,
        location:          booking.location,
        modality:          booking.modality,
        participantsCount: booking.participantsCount,
      });

      const previousSnap = await ref.get();

      /* Si ya existe y el evento es idéntico al anterior, omitir escritura */
      if (previousSnap.exists) {
        const previous = previousSnap.data();
        if (previous.lastEventHash === eventHash) {
          return res.status(200).json({
            ok:        true,
            skipped:   true,
            message:   "Evento repetido. No se volvió a escribir.",
            bookingId: booking.bookingId,
          });
        }
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const isCancellation = booking.status === "cancelled";

      if (isCancellation && previousSnap.exists) {
        await ref.set({
          bookingId: booking.bookingId,
          status: "cancelled",
          cancelledAt: booking.cancelledAt || now,
          cancelledAtRaw: booking.cancelledAtRaw || "",
          cancellationReceivedAt: now,
          updatedAt: now,
          receivedAt: now,
          lastEventHash: eventHash,
          lastCancellationPayload: payload,
        }, { merge: true });

        return res.status(200).json({
          ok: true,
          message: "Reserva marcada como cancelada.",
          bookingId: booking.bookingId,
          status: "cancelled",
        });
      }

      if (isCancellation && !previousSnap.exists) {
        const matchingBookings = await findMatchingActiveBookings(db, booking);

        if (matchingBookings.length) {
          const batch = db.batch();
          matchingBookings.forEach((doc) => {
            batch.set(doc.ref, {
              status: "cancelled",
              cancelledAt: booking.cancelledAt || now,
              cancelledAtRaw: booking.cancelledAtRaw || "",
              cancellationReceivedAt: now,
              updatedAt: now,
              receivedAt: now,
              lastEventHash: eventHash,
              lastCancellationPayload: payload,
              cancellationMatchedBookingId: booking.bookingId,
            }, { merge: true });
          });
          batch.set(ref, {
            ...booking,
            lastEventHash: eventHash,
            updatedAt: now,
            receivedAt: now,
            createdAt: now,
            cancellationReceivedAt: now,
            lastCancellationPayload: payload,
            matchedCancelledBookingIds: matchingBookings.map((doc) => doc.id),
          }, { merge: true });
          await batch.commit();

          return res.status(200).json({
            ok: true,
            message: "Cancelación aplicada a reserva existente por coincidencia.",
            bookingId: booking.bookingId,
            matchedBookingIds: matchingBookings.map((doc) => doc.id),
            status: "cancelled",
          });
        }
      }

      const dataToSave = {
        ...booking,
        lastEventHash: eventHash,
        updatedAt:     now,
        receivedAt:    now,
      };

      if (isCancellation) {
        dataToSave.cancelledAt = booking.cancelledAt || now;
        dataToSave.cancellationReceivedAt = now;
        dataToSave.lastCancellationPayload = payload;
      }

      if (booking.status === "updated") {
        dataToSave.updateReceivedAt = now;
        dataToSave.lastUpdatePayload = payload;
      }

      if (booking.status === "rescheduled") {
        dataToSave.rescheduleReceivedAt = now;
        dataToSave.lastReschedulePayload = payload;
      }

      /* createdAt solo en el primer insert */
      if (!previousSnap.exists) {
        dataToSave.createdAt = now;
      }

      /* merge:true conserva campos no incluidos en este payload */
      await ref.set(dataToSave, { merge: true });

      /* Reagendamiento/actualización: retirar la reserva original del horario
         viejo. Wix crea un booking_id nuevo en la fecha nueva (ya guardado
         arriba), pero la reserva original queda intacta bajo otro id en la
         fecha anterior. La marcamos como cancelada/superada para que no siga
         apareciendo en el horario viejo del aplicativo. */
      let supersededBookingIds = [];
      if (
        (booking.status === "updated" || booking.status === "rescheduled") &&
        booking.previousStartDate
      ) {
        const superseded = await findSupersededBookings(db, booking);
        if (superseded.length) {
          const batch = db.batch();
          superseded.forEach((doc) => {
            batch.set(doc.ref, {
              status: "cancelled",
              supersededByBookingId: booking.bookingId,
              supersededAt: now,
              cancellationReceivedAt: now,
              updatedAt: now,
            }, { merge: true });
          });
          await batch.commit();
          supersededBookingIds = superseded.map((doc) => doc.id);
          console.log("wixBookingWebhook superseded", {
            bookingId: booking.bookingId,
            previousStartDateRaw: booking.previousStartDateRaw,
            supersededBookingIds,
          });
        }
      }

      /* Duplicados en el MISMO horario (p.ej. cambio de docente con booking_id
         nuevo y misma fecha): retirar las versiones anteriores para que no se
         vean dos clases en el mismo espacio. */
      if (!isCancellation) {
        const duplicates = await findDuplicateSlotBookings(db, booking);
        if (duplicates.length) {
          const batch = db.batch();
          duplicates.forEach((doc) => {
            batch.set(doc.ref, {
              status: "cancelled",
              supersededByBookingId: booking.bookingId,
              supersededAt: now,
              cancellationReceivedAt: now,
              updatedAt: now,
            }, { merge: true });
          });
          await batch.commit();
          const dedupedBookingIds = duplicates.map((doc) => doc.id);
          supersededBookingIds = [...new Set([...supersededBookingIds, ...dedupedBookingIds])];
          console.log("wixBookingWebhook deduped same-slot", {
            bookingId: booking.bookingId,
            dedupedBookingIds,
          });
        }
      }

      /* Docente sin vincular: si quedó sin correo y tiene nombre, lo dejamos
         registrado en wixStaffUnmatched para que aparezca en el panel
         "Pendientes por vincular" sin que nadie tenga que avisarlo. No tocamos
         'status' para no revertir uno ya marcado como "linked". */
      if (!booking.staffEmail && staffKey) {
        try {
          await db.collection("wixStaffUnmatched").doc(staffKey).set({
            staffName: booking.staffName,
            normalizedName: staffKey,
            source: "wix-webhook",
            lastSeenAt: now,
            occurrences: admin.firestore.FieldValue.increment(1),
          }, { merge: true });
        } catch (unmatchedError) {
          console.warn("No se pudo registrar docente sin vincular", { staffKey, message: unmatchedError.message });
        }
      }

      return res.status(200).json({
        ok:        true,
        message:   isCancellation ? "Reserva cancelada guardada correctamente." : "Reserva guardada correctamente.",
        bookingId: booking.bookingId,
        status:    booking.status,
        supersededBookingIds,
      });

    } catch (error) {
      console.error("Error en wixBookingWebhook:", error);

      /* Guardar el error en calendarioWixSyncLogs (solo errores, no eventos exitosos) */
      try {
        await admin.firestore().collection("calendarioWixSyncLogs").add({
          type:      "function_error",
          message:   error.message || "Unknown error",
          stack:     error.stack   || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (logError) {
        console.error("No se pudo guardar log:", logError);
      }

      return res.status(500).json({ ok: false, error: "Internal server error" });
    }
  }
);

/* ============================================================
   Mantenimiento de un solo uso: dedupeCalendarioWix
   ------------------------------------------------------------
   Limpia duplicados YA existentes en el mismo horario (mismo
   startDate + identidad de grupo (roster/salón) + serviceName)
   dejando solo la reserva más reciente y marcando el resto como
   cancelada/superada. Pensado para el caso de talleres que cambiaron
   de docente y quedaron duplicados antes de desplegar la
   deduplicación del webhook.

   Uso (protegido con el mismo secreto del webhook):
     - Dry-run (no escribe, solo reporta):
         GET  .../dedupeCalendarioWix?secret=CLAVE
     - Aplicar cambios:
         GET  .../dedupeCalendarioWix?secret=CLAVE&apply=true
     - Limitar por rango de fechas (recomendado):
         &from=2026-06-01&to=2026-07-31
   ============================================================ */
exports.dedupeCalendarioWix = onRequest({ secrets: ["WIX_WEBHOOK_SECRET"] }, async (req, res) => {
  try {
    const secret =
      req.get("x-musicala-secret") ||
      (req.body && req.body.secret) ||
      req.query.secret ||
      "";
    if (secret !== process.env.WIX_WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const apply = String(req.query.apply || "") === "true";
    const from = cleanText(req.query.from);
    const to = cleanText(req.query.to);
    /* ignoreService=true agrupa por horario+cliente (sin serviceName): sirve
       para duplicados por cambio de docente donde el texto del servicio difiere
       (acentos mal codificados, etc.). Un mismo cliente no puede tener dos
       clases al mismo instante, así que es un criterio seguro. */
    const ignoreService = String(req.query.ignoreService || "") === "true";

    const db = admin.firestore();
    let query = db.collection("calendarioWix");
    /* startDate es Timestamp. Consultarlo con strings hacía que los rangos
       devolvieran cero resultados. El límite superior exclusivo incluye todo
       el día indicado en `to`. */
    if (from) {
      const fromDate = new Date(`${from}T00:00:00.000-05:00`);
      if (Number.isNaN(fromDate.getTime())) throw new Error("Parámetro from inválido (usa YYYY-MM-DD)");
      query = query.where("startDate", ">=", admin.firestore.Timestamp.fromDate(fromDate));
    }
    if (to) {
      const toDate = new Date(`${to}T00:00:00.000-05:00`);
      if (Number.isNaN(toDate.getTime())) throw new Error("Parámetro to inválido (usa YYYY-MM-DD)");
      toDate.setDate(toDate.getDate() + 1);
      query = query.where("startDate", "<", admin.firestore.Timestamp.fromDate(toDate));
    }
    const snap = await query.get();

    /* Agrupar activas por horario + identidad de grupo (roster/salón) + servicio */
    const groups = new Map();
    snap.docs.forEach((doc) => {
      const d = doc.data();
      if (normalizeStatus(d.status) === "cancelled") return;
      if (!d.startDate || !d.serviceName) return;
      const identity = groupIdentity(d);
      if (!identity) return;
      const key = [
        slotMinute(d.startDate),
        identity,
        ignoreService ? "" : cleanText(d.serviceName),
      ].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(doc);
    });

    const millis = (doc) => {
      const d = doc.data();
      const t = d.updatedAt || d.receivedAt || d.createdAt;
      return t && typeof t.toMillis === "function" ? t.toMillis() : 0;
    };

    const now = admin.firestore.FieldValue.serverTimestamp();
    const dupGroups = [];
    const toCancel = [];

    groups.forEach((docs, key) => {
      if (docs.length < 2) return;
      /* Conservar la más reciente; superar el resto. */
      const sorted = [...docs].sort((a, b) => millis(b) - millis(a));
      const keep = sorted[0];
      const drop = sorted.slice(1);
      dupGroups.push({
        key,
        keep: keep.id,
        keepStaff: keep.data().staffName || keep.data().staffEmail || "",
        keepService: keep.data().serviceName || "",
        drop: drop.map((doc) => ({
          id: doc.id,
          staff: doc.data().staffName || doc.data().staffEmail || "",
          service: doc.data().serviceName || "",
        })),
      });
      drop.forEach((doc) => toCancel.push({ ref: doc.ref, keepId: keep.id }));
    });

    const cancelledCount = toCancel.length;

    /* Escribir en lotes de 400 (límite de 500 por batch de Firestore). */
    if (apply && cancelledCount) {
      for (let i = 0; i < toCancel.length; i += 400) {
        const batch = db.batch();
        toCancel.slice(i, i + 400).forEach(({ ref, keepId }) => {
          batch.set(ref, {
            status: "cancelled",
            supersededByBookingId: keepId,
            supersededAt: now,
            cancellationReceivedAt: now,
            updatedAt: now,
            dedupMaintenance: true,
          }, { merge: true });
        });
        await batch.commit();
      }
    }

    return res.status(200).json({
      ok: true,
      applied: apply,
      scanned: snap.size,
      duplicateGroups: dupGroups.length,
      cancelled: cancelledCount,
      detail: dupGroups.slice(0, 200),
    });
  } catch (error) {
    console.error("Error en dedupeCalendarioWix:", error);
    return res.status(500).json({ ok: false, error: error.message || "Internal server error" });
  }
});

const ADMIN_EMAILS = new Set([
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
  "musicalaasesor@gmail.com",
  "adminmusicala@gmail.com",
]);

/*
  ============================================================
  PRUEBA MANUAL — PowerShell
  (reemplazar URL_DE_LA_FUNCTION con la URL real después del deploy)
  ============================================================

  $body = @{
    secret            = "AQUI_LA_CLAVE_SECRETA"
    bookingId         = "test_001"
    serviceName       = "Piano"
    staffName         = "Profe Musicala"
    staffEmail        = "profe@imusicala.com"
    customerName      = "Estudiante Prueba"
    customerEmail     = "estudiante@test.com"
    customerPhone     = "3000000000"
    startDate         = "2026-06-06T16:00:00-05:00"
    endDate           = "2026-06-06T17:00:00-05:00"
    status            = "confirmed"
    location          = "Musicala Sede"
    modality          = "Sede"
    participantsCount = 1
  } | ConvertTo-Json -Depth 10

  Invoke-RestMethod `
    -Uri "URL_DE_LA_FUNCTION" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"

  Resultado esperado:
    { ok: true, message: "Reserva guardada correctamente.", bookingId: "test_001" }

  Verificar en Firestore:
    calendarioWix/test_001
  ============================================================
*/
