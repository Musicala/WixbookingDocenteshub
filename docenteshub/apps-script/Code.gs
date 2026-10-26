const NOTIFICATION_RECIPIENT = "notificaciones.musicala@gmail.com";
const TIME_ZONE = "America/Bogota";

function testEmail() {
  MailApp.sendEmail({
    to: NOTIFICATION_RECIPIENT,
    subject: "Prueba HUB Docentes Musicala",
    htmlBody: "<p>Correo de prueba desde Apps Script.</p>",
    name: "HUB Docentes Musicala"
  });
}

function doPost(e) {
  try {
    const payload = parseRequestPayload_(e);
    const email = buildEmail_(payload);

    MailApp.sendEmail({
      to: NOTIFICATION_RECIPIENT,
      subject: email.subject,
      htmlBody: email.htmlBody,
      name: "HUB Docentes Musicala"
    });

    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function parseRequestPayload_(e) {
  const rawBody = e && e.postData && e.postData.contents
    ? e.postData.contents
    : "";

  if (!rawBody) {
    throw new Error("No se recibio contenido en la solicitud.");
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("El JSON recibido no es un objeto.");
    }
    return parsed;
  } catch (error) {
    throw new Error("No se pudo parsear el JSON recibido.");
  }
}

function buildEmail_(payload) {
  const name = cleanValue_(payload.name, "Docente");
  const teacherEmail = cleanValue_(payload.email, "Sin correo");
  const modalidad = formatModalidad_(payload.modalidad);
  const action = formatAction_(payload.action);
  const source = formatSource_(payload.source);
  const date = cleanValue_(payload.date, formatDate_(new Date()));
  const time = cleanValue_(payload.time, formatTime_(new Date()));
  const uid = cleanValue_(payload.uid, "No registrado");
  const exactStamp = formatExactStamp_(payload.stamp);

  const subject = [
    "Registro docente Musicala",
    name,
    modalidad,
    date + " " + time
  ].join(" · ");

  const rows = [
    ["Nombre del docente", name],
    ["Correo del docente", teacherEmail],
    ["Modalidad", modalidad],
    ["Accion", action],
    ["Fecha Bogota", date],
    ["Hora Bogota", time],
    ["Fuente del registro", source],
    ["UID", uid],
    ["Fecha/hora exacta del registro", exactStamp]
  ];

  const htmlRows = rows.map(function(row) {
    return "<tr>" +
      "<th style=\"text-align:left;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;\">" + escapeHtml_(row[0]) + "</th>" +
      "<td style=\"padding:8px 12px;border-bottom:1px solid #e5e7eb;\">" + escapeHtml_(row[1]) + "</td>" +
      "</tr>";
  }).join("");

  const htmlBody = "<div style=\"font-family:Arial,sans-serif;color:#111827;line-height:1.45;\">" +
    "<h2 style=\"margin:0 0 12px;\">Registro docente Musicala</h2>" +
    "<p style=\"margin:0 0 16px;\">Se registro un evento de jornada/clase desde el HUB Docentes Musicala.</p>" +
    "<table cellspacing=\"0\" cellpadding=\"0\" style=\"border-collapse:collapse;border:1px solid #e5e7eb;min-width:320px;\">" +
    htmlRows +
    "</table>" +
    "</div>";

  return {
    subject: subject,
    htmlBody: htmlBody
  };
}

function cleanValue_(value, fallback) {
  const text = String(value == null ? "" : value).trim();
  return text || fallback || "";
}

function formatModalidad_(value) {
  const map = {
    sede: "Sede",
    hogar: "Hogar",
    virtual: "Virtual"
  };
  return map[String(value || "").toLowerCase()] || cleanValue_(value, "Sin modalidad");
}

function formatAction_(value) {
  const map = {
    inicio_clase: "Inicio de clase / inicio de jornada",
    inicio_jornada: "Inicio de clase / inicio de jornada",
    fin_jornada: "Fin de jornada"
  };
  return map[String(value || "").toLowerCase()] || cleanValue_(value, "Inicio de clase / inicio de jornada");
}

function formatSource_(value) {
  const map = {
    qr_sede: "QR sede",
    manual_hogar: "Manual hogar",
    manual_virtual: "Manual virtual"
  };
  return map[String(value || "").toLowerCase()] || cleanValue_(value, "Sin fuente");
}

function formatExactStamp_(stamp) {
  const date = stamp ? new Date(stamp) : new Date();
  if (isNaN(date.getTime())) {
    return cleanValue_(stamp, "Sin fecha exacta");
  }
  return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd HH:mm:ss") + " Bogota";
}

function formatDate_(date) {
  return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd");
}

function formatTime_(date) {
  return Utilities.formatDate(date, TIME_ZONE, "HH:mm");
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
