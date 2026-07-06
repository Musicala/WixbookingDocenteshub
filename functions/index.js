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

const { onRequest } = require("firebase-functions/v2/https");
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
    if (booking.staffEmail && data.staffEmail && normalizeEmail(data.staffEmail) !== booking.staffEmail) return false;
    return true;
  });
}

/* Deduplicación por horario: si llega una reserva (nueva o actualizada) y ya
   existen OTRAS activas en el MISMO horario para el mismo cliente y servicio,
   son duplicados y se marcan como superados. Caso típico: al cambiar el
   docente en Wix (sin cambiar la fecha), Wix emite un booking_id nuevo y la
   versión anterior —con el docente viejo— queda duplicada en el mismo horario.
   A propósito NO se filtra por docente, para atrapar justamente esos cambios.
   Solo consulta por igualdades (startDate + customerEmail + serviceName), que
   Firestore resuelve sin índice compuesto. */
async function findDuplicateSlotBookings(db, booking) {
  if (!booking.startDate || !booking.customerEmail || !booking.serviceName) return [];

  const snap = await db.collection("calendarioWix")
    .where("startDate", "==", booking.startDate)
    .where("customerEmail", "==", booking.customerEmail)
    .where("serviceName", "==", booking.serviceName)
    .get();

  return snap.docs.filter((doc) => {
    if (doc.id === booking.bookingId) return false;
    return normalizeStatus(doc.data().status) !== "cancelled";
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
   startDate + customerEmail + serviceName) dejando solo la reserva
   más reciente y marcando el resto como cancelada/superada. Pensado
   para el caso de talleres que cambiaron de docente y quedaron
   duplicados antes de desplegar la deduplicación del webhook.

   Uso (protegido con el mismo secreto del webhook):
     - Dry-run (no escribe, solo reporta):
         GET  .../dedupeCalendarioWix?secret=CLAVE
     - Aplicar cambios:
         GET  .../dedupeCalendarioWix?secret=CLAVE&apply=true
     - Limitar por rango de fechas (recomendado):
         &from=2026-06-01&to=2026-07-31
   ============================================================ */
exports.dedupeCalendarioWix = onRequest(async (req, res) => {
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

    const db = admin.firestore();
    let query = db.collection("calendarioWix");
    if (from) query = query.where("startDate", ">=", from);
    if (to) query = query.where("startDate", "<=", to + "");
    const snap = await query.get();

    /* Agrupar activas por horario+cliente+servicio */
    const groups = new Map();
    snap.docs.forEach((doc) => {
      const d = doc.data();
      if (normalizeStatus(d.status) === "cancelled") return;
      if (!d.startDate || !d.customerEmail || !d.serviceName) return;
      const key = [
        d.startDate,
        normalizeEmail(d.customerEmail),
        cleanText(d.serviceName),
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
    let cancelledCount = 0;
    const batch = db.batch();

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
        drop: drop.map((doc) => ({ id: doc.id, staff: doc.data().staffName || doc.data().staffEmail || "" })),
      });
      drop.forEach((doc) => {
        cancelledCount += 1;
        if (apply) {
          batch.set(doc.ref, {
            status: "cancelled",
            supersededByBookingId: keep.id,
            supersededAt: now,
            cancellationReceivedAt: now,
            updatedAt: now,
            dedupMaintenance: true,
          }, { merge: true });
        }
      });
    });

    if (apply && cancelledCount) await batch.commit();

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
