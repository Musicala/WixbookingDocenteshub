/* ============================================================
   Reservas Wix · Calendario — Hub Docentes Musicala
   ------------------------------------------------------------
   Módulo autocontenido. Se monta sobre un contenedor del Hub
   y NO toca nada más del proyecto.

   Requisitos previos (en index.html del Hub):
     <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/locales/es.global.min.js"></script>
     <link rel="stylesheet" href="css/reservas-calendar.css">

   Uso desde el Hub:
     import { initReservasCalendar } from "./js/reservas-calendar.js";
     const modulo = initReservasCalendar({
       container: document.getElementById("modulo-reservas"),
       db,                      // instancia Firestore ya inicializada por el Hub
       userEmail: user.email,   // email del usuario autenticado
     });
     // Al salir del módulo:
     modulo.destroy();

   IMPORTANTE: la URL del import de Firestore (abajo) debe usar
   LA MISMA versión del SDK que ya usa el Hub, para no crear
   dos instancias incompatibles. Cambiar solo el número de versión.
   ============================================================ */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ----------------------- Configuración ---------------------- */

const COLLECTION_NAME = "calendarioWix";

const ADMIN_EMAILS = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
];

// Franja horaria visible en vistas de semana/día
const SLOT_MIN_TIME = "06:00:00";
const SLOT_MAX_TIME = "21:30:00";

// Duración por defecto si una reserva no trae endDate válido
const DEFAULT_DURATION_MIN = 60;
const CSV_BATCH_SIZE = 450;
const ROOM_ASSIGNMENTS_COLLECTION = "roomAssignments";
const ACADEMIC_LOG_URL = "https://musicala.github.io/docenteshub/";
const ROOMS = [
  "Salon 1: Baile",
  "Salon 2: Artes",
  "Salon 3: Musicalitos",
  "Salon 4: Multiproposito",
  "Salon 5: Musica",
  "Salon 6: Multiproposito",
  "Salon 7: Multiproposito",
  "Salon 8: Musicalitos",
  "Salon 9: Baile",
  "Salon 10: Multiproposito",
  "Ubicacion del estudiante",
];
const STUDENT_LOCATION_ROOM_INDEX = ROOMS.length - 1;

/* ----------------- Normalización de estados ----------------- */

const STATUS_MAP = {
  confirmed: "confirmed",
  confirmada: "confirmed",
  confirmado: "confirmed",
  cancelled: "cancelled",
  canceled: "cancelled",
  cancelada: "cancelled",
  cancelado: "cancelled",
  declined: "cancelled",
  rescheduled: "rescheduled",
  reagendada: "rescheduled",
  reagendado: "rescheduled",
  pending: "pending",
  pendiente: "pending",
  pending_approval: "pending",
  waiting_list: "pending",
  updated: "updated",
  actualizada: "updated",
  actualizado: "updated",
  blocked: "blocked",
  bloqueado: "blocked",
  bloqueada: "blocked",
  unavailable: "blocked",
  indisponible: "blocked",
};

const STATUS_LABELS = {
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  rescheduled: "Reagendada",
  pending: "Pendiente",
  updated: "Actualizada",
  blocked: "Bloqueado",
  unknown: "Sin estado",
};

function normalizeStatus(raw) {
  if (!raw) return "unknown";
  return STATUS_MAP[String(raw).trim().toLowerCase()] || "unknown";
}

/* ------------- Colores por instrumento / profesor ---------- */

/** Minúsculas + sin acentos, para comparar texto de forma robusta. */
function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Paleta con buen contraste sobre texto blanco. Se usa para asignar
// un color estable a cada profesor (vista admin).
const STAFF_PALETTE = [
  "#5d2fd1", // violeta
  "#1769ff", // azul
  "#d9531f", // coral
  "#0f8f68", // verde teal
  "#ce0071", // magenta
  "#0c41c4", // azul rey
  "#b02a8f", // púrpura
  "#1f7a5c", // verde
  "#c2410c", // naranja quemado
  "#3949ab", // índigo
  "#8a1c5a", // vino
  "#7a4b00", // ámbar oscuro
];

// Color por instrumento/servicio (vista docente). El primer grupo de
// palabras que aparezca en el nombre del servicio define el color.
const INSTRUMENT_COLORS = [
  { keys: ["bateria", "drum", "percusion"], color: "#d9531f", label: "Batería" },
  { keys: ["piano", "teclado"], color: "#6f35df", label: "Piano" },
  { keys: ["guitarra", "guitar"], color: "#1769ff", label: "Guitarra" },
  { keys: ["bajo", "bass"], color: "#0c41c4", label: "Bajo" },
  { keys: ["canto", "voz", "vocal"], color: "#ce0071", label: "Canto" },
  { keys: ["violin", "cuerda"], color: "#0f8f68", label: "Cuerdas" },
  { keys: ["saxo", "flauta", "clarinete", "trompeta", "viento"], color: "#b02a8f", label: "Vientos" },
  { keys: ["ballet", "danza", "baile", "urbana", "corporal"], color: "#c2410c", label: "Danza" },
  { keys: ["musikids", "musicalitos", "musigrandes", "vacacional", "taller", "musica", "arte", "ludico"], color: "#3949ab", label: "Musikids / talleres" },
];

const DEFAULT_ACCENT = "#5d2fd1";

/** Devuelve el color del instrumento según el nombre del servicio. */
function getInstrumentColor(serviceName) {
  const text = normalizeForMatch(serviceName);
  for (const item of INSTRUMENT_COLORS) {
    if (item.keys.some((key) => text.includes(key))) return item.color;
  }
  return DEFAULT_ACCENT;
}

/** Etiqueta legible del instrumento para la leyenda. */
function getInstrumentLabel(serviceName) {
  const text = normalizeForMatch(serviceName);
  for (const item of INSTRUMENT_COLORS) {
    if (item.keys.some((key) => text.includes(key))) return item.label;
  }
  return "Otras clases";
}

/** Hash estable de una cadena (para mapear profesor -> color fijo). */
function hashString(value) {
  const text = normalizeForMatch(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Color estable por profesor (mismo profe -> mismo color siempre). */
function getStaffColor(staffKey) {
  const key = normalizeForMatch(staffKey);
  if (!key) return "#8a8a98";
  return STAFF_PALETTE[hashString(key) % STAFF_PALETTE.length];
}

function humanFirestorePermissionError(error) {
  if (error?.code === "permission-denied") {
    return "Permisos de Firestore: publica las reglas de roomAssignments y permite update admin en calendarioWix.";
  }
  return error?.message || "No se pudo guardar.";
}

/* ----------------------- Utilidades ------------------------- */

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convierte Timestamp | string | Date a Date válido, o null. */
function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate(); // Timestamp
  if (value instanceof Date) return isNaN(value) ? null : value;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

/** Obtiene fecha de inicio de una reserva (Timestamp o raw). */
function getBookingStart(b) {
  return toDateSafe(b.startDate) || toDateSafe(b.startDateRaw);
}

/** Obtiene fecha de fin; si no existe, inicio + duración por defecto. */
function getBookingEnd(b, start) {
  const end = toDateSafe(b.endDate) || toDateSafe(b.endDateRaw);
  if (end) return end;
  if (!start) return null;
  return new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000);
}

/** Una reserva tiene datos incompletos si le falta algo esencial. */
function isIncomplete(b) {
  return (
    !b.serviceName ||
    !b.customerName ||
    !getBookingStart(b) ||
    !b.staffEmail
  );
}

function formatDateTime(d) {
  if (!d) return "—";
  return d.toLocaleString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(d) {
  if (!d) return "—";
  return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

function normalizeGroupText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getGroupKey(booking) {
  const start = getBookingStart(booking);
  if (!start) return "";
  return [
    start.getFullYear(),
    start.getMonth() + 1,
    start.getDate(),
    start.getHours(),
    start.getMinutes(),
    normalizeGroupText(booking.serviceName),
    normalizeGroupText(booking.staffEmail || booking.staffName),
  ].join("|");
}

/* ===================== Módulo principal ===================== */

function isStudentLocationClass(bookingOrEvent) {
  const serviceName = bookingOrEvent?.serviceName || bookingOrEvent?.extendedProps?.serviceName || "";
  const text = normalizeGroupText(serviceName);
  return text === "mh" || text.startsWith("mh ") || text.startsWith("mh:") || text.includes("musihome");
}

function getAutomaticRoomAssignment(booking, groupKey) {
  if (!isStudentLocationClass(booking)) return null;
  return {
    groupKey,
    roomIndex: STUDENT_LOCATION_ROOM_INDEX,
    roomName: ROOMS[STUDENT_LOCATION_ROOM_INDEX],
    automatic: true,
  };
}

/* =================== Relleno automático de salones =================== */
/* Índices 0-based de ROOMS. Salón N => índice N-1. */
const AUTO_ROOM = { S1: 0, S2: 1, S3: 2, S4: 3, S5: 4, S6: 5, S7: 6, S8: 7, S9: 8, S10: 9 };

/* Docentes cuyas clases personalizadas priman en el Salón 4. */
const SALON4_PRIORITY_STAFF = ["catalina medina", "alek caballero"];

function isPersonalizedService(name) {
  const t = normalizeForMatch(name);
  return t.includes("personaliz") || t.includes("individual");
}

function isSalon4PriorityStaff(staffName, staffEmail) {
  const t = normalizeForMatch(staffName);
  const e = normalizeForMatch(staffEmail);
  return SALON4_PRIORITY_STAFF.some((s) => t.includes(s)) ||
    e.includes("alekcaballero") || e.includes("catalina.medina");
}

/**
 * Clasifica un servicio en una categoría y devuelve los salones preferidos
 * (en orden) donde debería ubicarse, más un "peso" de prioridad (menor = se
 * asigna primero, para que reclame su salón preferido antes que otras).
 * Reglas de negocio definidas por Musicala (ver memoria del proyecto).
 */
function classifyRoomCategory({ serviceName, participantsCount, modality, staffName, staffEmail }) {
  const t = normalizeForMatch(serviceName);
  const m = normalizeForMatch(modality);

  /* 1. Virtual (MV) y afines -> Salón 5. */
  if (/^mv\b/.test(t) || t.startsWith("mv ") || t.startsWith("mv:") || m.includes("virtual")) {
    return { category: "virtual", rooms: [AUTO_ROOM.S5], weight: 5 };
  }

  /* 2. Reservas de espacio o clases con más de 8 participantes -> Salón 3. */
  if (Number(participantsCount) > 8 || t.includes("spaces") || t.includes("espacio") || t.includes("asesoria")) {
    return { category: "espacio", rooms: [AUTO_ROOM.S3, AUTO_ROOM.S10], weight: 0 };
  }

  /* 3. Baile (ballet, latino, teatro, exploración corporal...) -> S1 > S6 > S9. */
  const baileKeys = ["ballet", "baile", "latino", "danza", "urbana", "contemporane", "corporal", "teatro", "porras", "yoga", "musigym", "entrenamiento artistico"];
  if (baileKeys.some((k) => t.includes(k))) {
    return { category: "baile", rooms: [AUTO_ROOM.S1, AUTO_ROOM.S6, AUTO_ROOM.S9], weight: 1 };
  }

  /* 4. Exploración musical / musibabies / estimulación artística -> Salón 7. */
  const explKeys = ["musibabies", "estimulacion artistica", "exploracion artistica", "exploracion musical", "iniciacion musical"];
  const isMusicalitosExpl = t.includes("musicalitos") && (t.includes("musica") || t.includes("exploracion") || t.includes("artistica"));
  if (explKeys.some((k) => t.includes(k)) || isMusicalitosExpl) {
    return { category: "exploracion", rooms: [AUTO_ROOM.S7, AUTO_ROOM.S8, AUTO_ROOM.S4, AUTO_ROOM.S10], weight: 3 };
  }

  /* 5. Artes plásticas -> S2 > S6 > S9. */
  const artesKeys = ["artes plasticas", "plastica", "dibujo", "tecnicas mixtas"];
  const isArte = artesKeys.some((k) => t.includes(k)) || /\barte\b/.test(t) || t.includes("taller de artes") || t.includes("- arte");
  if (isArte) {
    return { category: "artes", rooms: [AUTO_ROOM.S2, AUTO_ROOM.S6, AUTO_ROOM.S9], weight: 1 };
  }

  /* 6. Batería / ensamble / percusión -> Salón 10 primero. */
  const percKeys = ["bateria", "drum", "percusion", "ensamble"];
  if (percKeys.some((k) => t.includes(k))) {
    return { category: "percusion", rooms: [AUTO_ROOM.S10, AUTO_ROOM.S4, AUTO_ROOM.S8], weight: 3 };
  }

  /* 7. Instrumentos / música en general -> S4 > S8 > S10.
        Las personalizadas de Catalina Medina y Alek Caballero priman en S4. */
  const priority = isPersonalizedService(serviceName) && isSalon4PriorityStaff(staffName, staffEmail);
  return {
    category: priority ? "instrumento-prioritario" : "instrumento",
    rooms: [AUTO_ROOM.S4, AUTO_ROOM.S8, AUTO_ROOM.S10],
    weight: priority ? 2 : 4,
  };
}

function getBookingCancellationMatchKey(booking) {
  const start = getBookingStart(booking);
  if (!start) return "";
  return [
    start.getFullYear(),
    start.getMonth() + 1,
    start.getDate(),
    start.getHours(),
    start.getMinutes(),
    normalizeGroupText(booking.serviceName),
    normalizeGroupText(booking.staffEmail || booking.staffName),
    String(booking.customerEmail || "").trim().toLowerCase() || normalizeGroupText(booking.customerName),
  ].join("|");
}

function getParticipantKey(participant) {
  const email = String(participant?.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return `name:${normalizeGroupText(participant?.name)}`;
}

function uniqueParticipants(participants) {
  const seen = new Set();
  return (Array.isArray(participants) ? participants : []).filter((participant) => {
    const key = getParticipantKey(participant);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function initReservasCalendar({ container, db, userEmail, loadStudentHubData, onDisplayModeChange }) {
  if (!container) throw new Error("[ReservasCalendar] Falta container.");
  if (!db) throw new Error("[ReservasCalendar] Falta instancia de Firestore (db).");
  if (!userEmail) throw new Error("[ReservasCalendar] Falta userEmail.");

  const email = String(userEmail).trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(email);

  /* ------------------------- Estado ------------------------- */

  const state = {
    calendar: null,
    unsubscribe: null,        // listener Firestore activo
    currentRangeKey: "",      // evita re-suscripciones al mismo rango
    bookings: new Map(),      // bookingId -> data del rango visible
    staffLinks: new Map(),    // nombre normalizado de Wix/CSV -> email Hub
    roomAssignments: new Map(), // groupKey -> asignacion de salon
    filters: { alcance: "mine", docente: "", estado: "", servicio: "", especial: "" },
    displayMode: "calendar",
    roomsView: isAdmin ? "table" : "live",
    roomsSearch: "",
    roomsDate: null,
    destroyed: false,
  };

  /* --------------------- Estructura DOM --------------------- */

  container.innerHTML = `
    <section class="mcal" aria-label="Calendario de reservas Wix">
      <header class="mcal__header">
        <div class="mcal__title-block">
          <h2 class="mcal__title">Clases asignadas</h2>
          <p class="mcal__subtitle">${
            isAdmin
              ? "Tus clases asignadas. Cambia a vista admin para ver todo."
              : "Tus clases asignadas desde Wix"
          }</p>
        </div>
        <div class="mcal__modebar" aria-label="Cambiar vista">
          <button type="button" class="mcal__mode-button is-active" data-mcal-mode="calendar">Calendario</button>
          <button type="button" class="mcal__mode-button" data-mcal-mode="rooms">Salones</button>
        </div>
        ${isAdmin ? renderAdminFiltersHTML() : ""}
      </header>
      <div class="mcal__legend" role="note">
        <span class="mcal__chip mcal__chip--confirmed">Confirmada</span>
        <span class="mcal__chip mcal__chip--pending">Pendiente</span>
        <span class="mcal__chip mcal__chip--rescheduled">Reagendada</span>
        <span class="mcal__chip mcal__chip--updated">Actualizada</span>
        <span class="mcal__chip mcal__chip--blocked">Bloqueado</span>
        <span class="mcal__chip mcal__chip--cancelled">Cancelada</span>
      </div>
      <div class="mcal-updates" id="mcal-updates" hidden></div>
      <div class="mcal__calendar" id="mcal-calendar"></div>
      <div class="mcal-rooms" id="mcal-rooms" hidden></div>
      <p class="mcal__empty" id="mcal-empty" hidden>
        No hay reservas en el rango visible.
      </p>
    </section>
    ${isAdmin ? renderStaffSettingsHTML() : ""}
    <div class="mcal-modal" id="mcal-modal" hidden>
      <div class="mcal-modal__overlay" data-mcal-close></div>
      <article class="mcal-modal__panel" role="dialog" aria-modal="true" aria-labelledby="mcal-modal-title">
        <header class="mcal-modal__header">
          <h3 class="mcal-modal__title" id="mcal-modal-title"></h3>
          <button type="button" class="mcal-modal__close" data-mcal-close aria-label="Cerrar detalle">×</button>
        </header>
        <div class="mcal-modal__body" id="mcal-modal-body"></div>
      </article>
    </div>
  `;

  function renderAdminFiltersHTML() {
    return `
      <div class="mcal__filters" id="mcal-filters">
        <label class="mcal__filter">
          <span>Vista</span>
          <select id="mcal-f-alcance">
            <option value="mine" selected>Mis clases</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label class="mcal__filter">
          <span>Docente</span>
          <select id="mcal-f-docente" disabled><option value="">Todos</option></select>
        </label>
        <label class="mcal__filter">
          <span>Estado</span>
          <select id="mcal-f-estado">
            <option value="">Todos</option>
            <option value="confirmed">Confirmada</option>
            <option value="pending">Pendiente</option>
            <option value="rescheduled">Reagendada</option>
            <option value="updated">Actualizada</option>
            <option value="blocked">Bloqueado</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label class="mcal__filter">
          <span>Servicio</span>
          <select id="mcal-f-servicio"><option value="">Todos</option></select>
        </label>
        <label class="mcal__filter">
          <span>Revisión</span>
          <select id="mcal-f-especial">
            <option value="">—</option>
            <option value="sin-docente">Sin docente</option>
            <option value="canceladas">Solo canceladas</option>
            <option value="incompletas">Datos incompletos</option>
          </select>
        </label>
        <label class="mcal__upload">
          <span>Emergencia</span>
          <input id="mcal-csv-upload" type="file" accept=".csv,text/csv" hidden>
          <button type="button" id="mcal-csv-button">Subir CSV</button>
        </label>
        <p class="mcal__upload-status" id="mcal-upload-status" aria-live="polite"></p>
        <button type="button" class="mcal__settings-button" id="mcal-staff-settings-button">Vincular docentes <span class="mcal__settings-badge" id="mcal-staff-pending-badge" hidden></span></button>
      </div>
    `;
  }

  function renderStaffSettingsHTML() {
    return `
      <aside class="mcal-settings" id="mcal-staff-settings" hidden>
        <div class="mcal-settings__overlay" data-mcal-settings-close></div>
        <section class="mcal-settings__panel" aria-label="Vincular docentes Wix">
          <header class="mcal-settings__header">
            <div>
              <h3>Vincular docentes</h3>
              <p>Relaciona el nombre que llega desde Wix o CSV con el correo del Hub.</p>
            </div>
            <button type="button" class="mcal-modal__close" data-mcal-settings-close aria-label="Cerrar ajustes">×</button>
          </header>
          <div class="mcal-settings__body">
            <div class="mcal-settings__user">
              <h4>Agregar acceso al Hub</h4>
              <div class="mcal-settings__user-grid">
                <label>
                  <span>Correo</span>
                  <input id="mcal-user-email" type="email" placeholder="docente@correo.com">
                </label>
                <label>
                  <span>Nombre visible</span>
                  <input id="mcal-user-label" type="text" placeholder="Nombre del docente">
                </label>
                <button type="button" id="mcal-user-save">Agregar acceso</button>
              </div>
            </div>
            <div class="mcal-settings__manual">
              <label>
                <span>Nombre en Wix</span>
                <input id="mcal-staff-name" type="text" placeholder="Ej. Angie Nitola">
              </label>
              <label>
                <span>Correo Hub</span>
                <select id="mcal-staff-email"></select>
              </label>
              <button type="button" id="mcal-staff-save">Guardar vínculo</button>
              <button type="button" id="mcal-staff-apply-links">Aplicar vínculos a reservas</button>
            </div>
            <p class="mcal-settings__status" id="mcal-staff-status" aria-live="polite"></p>
            <h4 class="mcal-settings__section-title">Pendientes por vincular</h4>
            <div class="mcal-settings__list" id="mcal-staff-unmatched"></div>
            <h4 class="mcal-settings__section-title">Vínculos guardados</h4>
            <div class="mcal-settings__list" id="mcal-staff-linked"></div>
          </div>
        </section>
      </aside>
    `;
  }

  const calendarEl = container.querySelector("#mcal-calendar");
  const roomsEl = container.querySelector("#mcal-rooms");
  const emptyEl = container.querySelector("#mcal-empty");
  const modalEl = container.querySelector("#mcal-modal");
  const modalTitleEl = container.querySelector("#mcal-modal-title");
  const modalBodyEl = container.querySelector("#mcal-modal-body");

  /* --------------------- FullCalendar ----------------------- */

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  state.calendar = new FullCalendar.Calendar(calendarEl, {
    locale: "es",
    initialView: isAdmin && !isMobile ? "timeGridWeek" : "listWeek",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
    },
    buttonText: {
      today: "Hoy",
      month: "Mes",
      week: "Semana",
      day: "Día",
      list: "Lista",
    },
    height: "auto",
    expandRows: true,
    nowIndicator: true,
    slotMinTime: SLOT_MIN_TIME,
    slotMaxTime: SLOT_MAX_TIME,
    slotDuration: "00:30:00",
    allDaySlot: false,
    firstDay: 1, // lunes
    dayMaxEventRows: 4,
    eventTimeFormat: { hour: "numeric", minute: "2-digit", meridiem: "short" },
    displayEventEnd: false,

    // Cada vez que cambia el rango visible (mes/semana/día o navegación),
    // re-consultamos Firestore SOLO para ese rango.
    datesSet(info) {
      subscribeToRange(info.start, info.end);
    },

    eventClick(info) {
      if (info.event.extendedProps.isGroup) {
        openDetailData({
          ...info.event.extendedProps,
          startDate: info.event.start,
          endDate: info.event.end,
        });
        return;
      }
      openDetail(info.event.extendedProps.bookingId || info.event.id);
    },

    // Texto compacto del evento: "Servicio - Cliente" (+ prefijo si aplica)
    eventContent(arg) {
      const p = arg.event.extendedProps;
      const cancelled = p.statusKey === "cancelled";
      const blocked = p.statusKey === "blocked";
      const time = arg.timeText ? `<span class="mcal-ev__time">${escapeHTML(arg.timeText)}</span>` : "";
      const prefix = cancelled
        ? `<span class="mcal-ev__tag">Cancelada</span> `
        : blocked
          ? `<span class="mcal-ev__tag">Bloqueado</span> `
          : "";
      const extra =
        !isMobile && (p.roomAssignment?.roomName || p.modality)
          ? `<span class="mcal-ev__meta">${escapeHTML(p.roomAssignment?.roomName || p.modality)}</span>`
          : "";
      const dot = !cancelled && p.accentColor
        ? `<span class="mcal-ev__dot" style="background:${escapeHTML(p.accentColor)}"></span>`
        : "";
      return {
        html: `
          <div class="mcal-ev">
            <span class="mcal-ev__top">${dot}${time}</span>
            <span class="mcal-ev__main">${prefix}${escapeHTML(p.serviceName || "Clase")} - ${escapeHTML(p.isGroup ? `${p.groupCount} participantes` : (p.customerName || p.staffName || "Sin nombre"))}</span>
            ${extra}
          </div>`,
      };
    },
  });

  state.calendar.render();

  /* Aviso de novedades: cambios en las clases del docente desde su última visita. */
  showChangesBanner();

  /* Contador de docentes pendientes por vincular (solo admin). */
  if (isAdmin) updatePendingStaffBadge();

  /* ------------------- Firestore: rango --------------------- */

  function subscribeToRange(rangeStart, rangeEnd) {
    if (state.destroyed) return;

    const key = `${rangeStart.getTime()}-${rangeEnd.getTime()}`;
    if (key === state.currentRangeKey) return; // mismo rango: no re-suscribir
    state.currentRangeKey = key;

    // 1) Cancelar el listener anterior SIEMPRE antes de abrir otro
    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }

    const col = collection(db, COLLECTION_NAME);
    const tsStart = Timestamp.fromDate(rangeStart);
    const tsEnd = Timestamp.fromDate(rangeEnd);

    // 2) Consulta limitada al rango visible (controla lecturas).
    //    Admin siempre trae el rango visible y filtra en cliente:
    //    evita depender del índice compuesto staffEmail + startDate.
    //    Docente no admin sí consulta solo su staffEmail por seguridad.
    const q = isAdmin
      ? query(
          col,
          where("startDate", ">=", tsStart),
          where("startDate", "<", tsEnd),
          orderBy("startDate", "asc")
        )
      : query(
          col,
          where("staffEmail", "==", email),
          where("startDate", ">=", tsStart),
          where("startDate", "<", tsEnd),
          orderBy("startDate", "asc")
        );

    state.unsubscribe = onSnapshot(
      q,
      async (snap) => {
        state.bookings.clear();
        snap.forEach((doc) => {
          state.bookings.set(doc.id, { ...doc.data(), _docId: doc.id });
        });
        if (isAdmin) {
          await refreshStaffLinks();
          await backfillVisibleStaffEmails();
        }
        await refreshRoomAssignments(rangeStart, rangeEnd);
        if (isAdmin) refreshAdminFilterOptions();
        renderEvents();
      },
      (err) => {
        // Si Firestore pide un índice compuesto, la consola del navegador
        // mostrará un link directo para crearlo. Ver README → Índices.
        console.error("[ReservasCalendar] Error de Firestore:", err);
        if (err && err.code === "failed-precondition") {
          showEmptyMessage(
            "Firestore necesita un índice para esta consulta. Abre la consola del navegador y usa el enlace que aparece para crearlo."
          );
        }
      }
    );
  }

  /* ---------------- Reservas → eventos FC ------------------- */

  // Color de acento de una reserva: por profesor si es admin,
  // por instrumento/servicio si es docente.
  function getBookingAccent(b) {
    return isAdmin
      ? getStaffColor(b.staffEmail || b.staffName)
      : getInstrumentColor(b.serviceName);
  }

  function bookingToEvent(b) {
    const start = getBookingStart(b);
    if (!start) return null; // sin fecha válida no se puede ubicar en calendario
    const end = getBookingEnd(b, start);
    const statusKey = normalizeStatus(b.status);
    const groupKey = getGroupKey(b) || (b.bookingId || b._docId);
    const roomAssignment = getAutomaticRoomAssignment(b, groupKey) ||
      state.roomAssignments.get(groupKey) ||
      (b.roomName ? { roomIndex: b.roomIndex, roomName: b.roomName, groupKey } : null);

    const accent = getBookingAccent(b);
    const event = {
      id: b.bookingId || b._docId,
      title: `${b.serviceName || "Clase"} - ${b.customerName || b.staffName || "Sin nombre"}`,
      start,
      end,
      classNames: ["mcal-event", `mcal-event--${statusKey}`],
      extendedProps: {
        bookingId: b.bookingId || b._docId,
        groupKey,
        serviceName: b.serviceName,
        staffName: b.staffName,
        staffEmail: b.staffEmail,
        customerName: b.customerName,
        customerEmail: b.customerEmail,
        studentEmails: b.studentEmails,
        customerPhone: b.customerPhone,
        status: b.status,
        statusKey,
        location: b.location,
        modality: b.modality,
        notes: b.notes,
        participantsCount: b.participantsCount,
        source: b.source,
        updatedAt: b.updatedAt,
        roomAssignment,
        accentColor: accent,
      },
    };

    // Acento sutil: SIEMPRE fondo blanco y texto oscuro. El color solo
    // aparece como rayita lateral (borde izquierdo) y como puntito en el
    // contenido del evento, para no saturar la vista.
    //  - canceladas: grises y atenuadas.
    if (statusKey === "cancelled") {
      event.backgroundColor = "#f3f3f5";
      event.borderColor = "#d7d7de";
      event.textColor = "#8a8a98";
    } else {
      event.backgroundColor = "#ffffff";
      event.borderColor = accent;
      event.textColor = "#132038";
    }

    return event;
  }

  function passesAdminFilters(b) {
    const statusKey = normalizeStatus(b.status);
    if (!isAdmin) return statusKey !== "cancelled";

    const f = state.filters;
    const wantsCancelled = f.especial === "canceladas" || f.estado === "cancelled";

    if (statusKey === "cancelled" && !wantsCancelled) return false;
    if (wantsCancelled && statusKey !== "cancelled") return false;

    if (f.alcance !== "all" && !bookingBelongsToEmail(b, email)) return false;

    if (f.especial === "sin-docente" && b.staffEmail) return false;
    if (f.especial === "incompletas" && !isIncomplete(b)) return false;

    if (f.docente && (b.staffEmail || "").toLowerCase() !== f.docente) return false;
    if (f.estado && statusKey !== f.estado) return false;
    if (f.servicio && (b.serviceName || "") !== f.servicio) return false;
    return true;
  }

  function bookingBelongsToEmail(booking, targetEmail) {
    const normalizedTarget = String(targetEmail || "").trim().toLowerCase();
    if (!normalizedTarget) return false;
    if (String(booking.staffEmail || "").trim().toLowerCase() === normalizedTarget) return true;

    const linkedEmail = state.staffLinks.get(normalizeStaffKey(booking.staffName));
    return linkedEmail === normalizedTarget;
  }

  async function refreshStaffLinks() {
    const links = new Map();
    const snap = await getDocs(collection(db, "wixStaffMap"));
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const key = normalizeStaffKey(data.staffName || docSnap.id);
      const linkedEmail = String(data.staffEmail || "").trim().toLowerCase();
      if (key && linkedEmail) links.set(key, linkedEmail);
    });
    state.staffLinks = links;
  }

  async function backfillVisibleStaffEmails() {
    if (!state.staffLinks.size || !state.bookings.size) return 0;

    let batch = writeBatch(db);
    let batchCount = 0;
    let updated = 0;

    async function commitIfNeeded(force = false) {
      if (batchCount > 0 && (force || batchCount >= CSV_BATCH_SIZE)) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    for (const [docId, booking] of state.bookings.entries()) {
      const linkedEmail = state.staffLinks.get(normalizeStaffKey(booking.staffName));
      if (!linkedEmail) continue;
      if (String(booking.staffEmail || "").toLowerCase() === linkedEmail) continue;

      batch.set(doc(db, COLLECTION_NAME, docId), {
        staffEmail: linkedEmail,
        staffLinkedFromName: booking.staffName || "",
        updatedAt: serverTimestamp(),
      }, { merge: true });

      state.bookings.set(docId, {
        ...booking,
        staffEmail: linkedEmail,
        staffLinkedFromName: booking.staffName || "",
      });

      batchCount += 1;
      updated += 1;
      await commitIfNeeded();
    }

    await commitIfNeeded(true);
    if (updated) console.info(`[ReservasCalendar] ${updated} reservas visibles vinculadas automáticamente.`);
    return updated;
  }

  function renderEvents() {
    if (state.destroyed) return;
    const grouped = new Map();
    const cancelledMatchKeys = new Set();
    state.bookings.forEach((b) => {
      if (normalizeStatus(b.status) === "cancelled") {
        const key = getBookingCancellationMatchKey(b);
        if (key) cancelledMatchKeys.add(key);
      }
    });
    state.bookings.forEach((b) => {
      if (!passesAdminFilters(b)) return;
      if (normalizeStatus(b.status) !== "cancelled" && cancelledMatchKeys.has(getBookingCancellationMatchKey(b))) return;
      const key = getGroupKey(b) || (b.bookingId || b._docId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(b);
    });

    const events = [];
    grouped.forEach((bookings) => {
      const ev = bookings.length > 1 ? groupBookingsToEvent(bookings) : bookingToEvent(bookings[0]);
      if (ev) events.push(ev);
    });

    state.calendar.removeAllEvents();
    state.calendar.addEventSource(events);
    renderRoomsView();
    emptyEl.hidden = events.length > 0;
    if (events.length === 0) {
      emptyEl.textContent = "No hay reservas en el rango visible.";
    }
  }

  function groupBookingsToEvent(bookings) {
    const base = bookings[0];
    const event = bookingToEvent(base);
    if (!event) return null;
    const groupKey = getGroupKey(base);
    const bookingWithRoom = bookings.find((booking) => booking.roomName || booking.roomIndex !== undefined);
    const groupRoomAssignment = getAutomaticRoomAssignment(base, groupKey) ||
      state.roomAssignments.get(groupKey) ||
      event.extendedProps.roomAssignment ||
      (bookingWithRoom?.roomName ? {
        groupKey,
        roomIndex: bookingWithRoom.roomIndex,
        roomName: bookingWithRoom.roomName,
      } : null);

    const participants = uniqueParticipants(bookings.map((booking) => ({
      name: booking.customerName || "Sin nombre",
      email: booking.customerEmail || "",
      phone: booking.customerPhone || "",
      bookingId: booking.bookingId || booking._docId || "",
    })));
    const count = participants.length;

    event.id = `group_${getGroupKey(base)}`;
    event.title = `${base.serviceName || "Clase"} - ${count} participantes`;
    event.extendedProps = {
      ...event.extendedProps,
      isGroup: true,
      groupKey,
      groupCount: count,
      groupBookingIds: bookings.map((booking) => booking.bookingId || booking._docId),
      participants,
      customerName: `${count} participantes`,
      customerEmail: participants.map((p) => p.email).filter(Boolean).join(", "),
      participantsCount: count,
      roomAssignment: groupRoomAssignment,
    };
    return event;
  }

  async function refreshRoomAssignments(rangeStart, rangeEnd) {
    const assignments = new Map();
    try {
      const snap = await getDocs(query(
        collection(db, ROOM_ASSIGNMENTS_COLLECTION),
        where("startDate", ">=", Timestamp.fromDate(rangeStart)),
        where("startDate", "<", Timestamp.fromDate(rangeEnd)),
        orderBy("startDate", "asc")
      ));
      snap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (data.groupKey) assignments.set(data.groupKey, data);
      });
    } catch (error) {
      console.warn("[ReservasCalendar] No se pudieron leer salones asignados:", error);
      if (roomsEl) {
        roomsEl.dataset.permissionError = humanFirestorePermissionError(error);
      }
    }
    state.roomAssignments = assignments;
  }

  function buildRoomsEvents() {
    const grouped = new Map();
    const cancelledMatchKeys = new Set();
    state.bookings.forEach((b) => {
      if (normalizeStatus(b.status) === "cancelled") {
        const key = getBookingCancellationMatchKey(b);
        if (key) cancelledMatchKeys.add(key);
      }
    });
    state.bookings.forEach((b) => {
      if (normalizeStatus(b.status) === "cancelled") return;
      if (cancelledMatchKeys.has(getBookingCancellationMatchKey(b))) return;
      if (isAdmin) {
        if (!passesAdminFilters(b)) return;
      } else if (!bookingBelongsToEmail(b, email)) {
        return;
      }
      const key = getGroupKey(b) || (b.bookingId || b._docId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(b);
    });

    const events = [];
    grouped.forEach((bookings) => {
      const ev = bookings.length > 1 ? groupBookingsToEvent(bookings) : bookingToEvent(bookings[0]);
      if (ev) events.push(ev);
    });
    return events;
  }

  function renderRoomsView() {
    if (!roomsEl) return;
    const events = buildRoomsEvents();
    const day = getRoomsSelectedDay(events);
    const dayEvents = events
      .filter((event) => sameLocalDate(new Date(event.start), day))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const assignedEvents = dayEvents.filter((event) => event.extendedProps?.roomAssignment);
    const unassignedEvents = dayEvents.filter((event) => !event.extendedProps?.roomAssignment);
    const filteredEvents = filterRoomEvents(dayEvents);

    roomsEl.innerHTML = `
      <div class="mcal-rooms__head">
        <div>
          <h3>Asignacion de salones</h3>
          <p>${isAdmin ? "Organiza todas las clases del dia por salon." : "Tus clases del dia organizadas por salon."}</p>
        </div>
        <div class="mcal-rooms__nav">
          ${isAdmin ? `<button type="button" data-rooms-autofill>Relleno automatico</button>` : ""}
          ${isAdmin ? `<button type="button" data-academic-task>Nueva tarea academica</button>` : ""}
          <button type="button" data-rooms-date="-1" aria-label="Dia anterior">‹</button>
          <button type="button" data-rooms-date="today">Hoy</button>
          <button type="button" data-rooms-date="1" aria-label="Dia siguiente">›</button>
          <strong>${escapeHTML(day.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</strong>
        </div>
        <span class="mcal-rooms__notice" data-rooms-notice>${escapeHTML(roomsEl.dataset.permissionError || `${assignedEvents.length} clase(s) con salon`)}</span>
      </div>
      <div class="mcal-rooms-layout">
        <aside class="mcal-rooms-sidebar" aria-label="Clases sin salon asignado">
          <div class="mcal-rooms-sidebar__head">
            <strong>Sin salon asignado</strong>
            <span>${unassignedEvents.length}</span>
          </div>
          <div class="mcal-rooms-sidebar__list">
            ${unassignedEvents.map((event) => renderRoomListItem(event, true)).join("")}
          </div>
        </aside>
        <section class="mcal-rooms-main">
          <div class="mcal-rooms-tabs" role="tablist" aria-label="Vistas de salones">
            ${renderRoomsTab("table", "Tabla")}
            ${renderRoomsTab("live", "En vivo")}
            ${renderRoomsTab("rooms", "Salones")}
            ${renderRoomsTab("teachers", "Docentes")}
            ${renderRoomsTab("search", "Buscar")}
            ${renderRoomsTab("kpis", "KPIs")}
          </div>
          <div class="mcal-rooms-panel">
            ${renderRoomsPanel(state.roomsView, { dayEvents, assignedEvents, filteredEvents })}
          </div>
        </section>
      </div>
    `;
  }

  function renderRoomsTab(value, label) {
    const active = state.roomsView === value;
    return `
      <button type="button" class="mcal-rooms-tab${active ? " is-active" : ""}" data-rooms-view="${escapeHTML(value)}" role="tab" aria-selected="${active ? "true" : "false"}">
        ${escapeHTML(label)}
      </button>
    `;
  }

  function renderRoomsPanel(view, data) {
    if (view === "table") return renderRoomsTable(data.assignedEvents);
    if (view === "rooms") return renderRoomsByRoom(data.filteredEvents);
    if (view === "teachers") return renderRoomsByTeacher(data.filteredEvents);
    if (view === "search") return renderRoomsSearch(data.filteredEvents);
    if (view === "kpis") return renderRoomsKpis(data.dayEvents);
    return renderRoomsLive(data.dayEvents);
  }

  function renderRoomsTable(assignedEvents) {
    return `
      <div class="mcal-rooms__table-wrap">
        <table class="mcal-rooms-table">
          <thead>
            <tr>
              <th>Hora</th>
              ${ROOMS.map((room) => `<th>${escapeHTML(room)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${buildRoomSlots().map((slot) => renderRoomSlotRow(slot, assignedEvents)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function filterRoomEvents(events) {
    const query = normalizeGroupText(state.roomsSearch);
    if (!query) return events;
    return events.filter((event) => {
      const p = event.extendedProps || {};
      return [
        p.serviceName,
        p.staffName,
        p.customerName,
        p.customerEmail,
        p.roomAssignment?.roomName,
      ].some((value) => normalizeGroupText(value).includes(query));
    });
  }

  function renderRoomsLive(events) {
    const now = new Date();
    const current = events.filter((event) => new Date(event.start) <= now && new Date(event.end) > now);
    const previous = [...events].filter((event) => new Date(event.end) <= now).slice(-6);
    const next = events.filter((event) => new Date(event.start) > now).slice(0, 8);
    return `
      <div class="mcal-live-grid">
        ${renderLiveColumn("Anterior", previous)}
        ${renderLiveColumn("Ahora", current)}
        ${renderLiveColumn("Siguiente", next)}
      </div>
    `;
  }

  function renderLiveColumn(label, events) {
    return `
      <section class="mcal-live-column">
        <h4>${escapeHTML(label)}</h4>
        ${events.length ? events.map(renderRoomListItem).join("") : `<p>No hay clases.</p>`}
      </section>
    `;
  }

  function renderRoomsByRoom(events) {
    return `
      <div class="mcal-room-columns">
        ${ROOMS.map((room, index) => {
          const matches = events.filter((event) => Number(event.extendedProps?.roomAssignment?.roomIndex) === index);
          return `
            <section class="mcal-room-column${index === STUDENT_LOCATION_ROOM_INDEX ? " mcal-room-column--student-location" : ""}" data-room-drop="${index}">
              <h4>${escapeHTML(room)} <span>${matches.length}</span></h4>
              ${matches.length ? matches.map(renderRoomEvent).join("") : `<p>Libre</p>`}
            </section>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderRoomsByTeacher(events) {
    const grouped = new Map();
    events.forEach((event) => {
      const name = event.extendedProps?.staffName || "Sin docente";
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(event);
    });
    return `
      <div class="mcal-teacher-groups">
        ${[...grouped.entries()].map(([teacher, items]) => `
          <section class="mcal-teacher-group">
            <h4>${escapeHTML(teacher)} <span>${items.length}</span></h4>
            ${items.map(renderRoomListItem).join("")}
          </section>
        `).join("") || `<p>No hay clases para mostrar.</p>`}
      </div>
    `;
  }

  function renderRoomsSearch(events) {
    return `
      <div class="mcal-rooms-search">
        <input type="search" data-rooms-search placeholder="Buscar clase, docente, estudiante o salon" value="${escapeHTML(state.roomsSearch)}">
      </div>
      <div class="mcal-rooms-search-results">
        ${events.length ? events.map(renderRoomListItem).join("") : `<p>No hay resultados.</p>`}
      </div>
    `;
  }

  function renderRoomsKpis(events) {
    const assigned = events.filter((event) => event.extendedProps?.roomAssignment).length;
    const teachers = new Set(events.map((event) => event.extendedProps?.staffName || "").filter(Boolean)).size;
    const occupiedRooms = new Set(events.map((event) => event.extendedProps?.roomAssignment?.roomName || "").filter(Boolean)).size;
    return `
      <div class="mcal-kpis">
        ${renderKpi("Clases", events.length)}
        ${renderKpi("Con salon", assigned)}
        ${renderKpi("Sin salon", events.length - assigned)}
        ${renderKpi("Docentes", teachers)}
        ${renderKpi("Salones ocupados", occupiedRooms)}
      </div>
    `;
  }

  function renderKpi(label, value) {
    return `<div class="mcal-kpi"><strong>${escapeHTML(String(value))}</strong><span>${escapeHTML(label)}</span></div>`;
  }

  function getRoomsSelectedDay(events = []) {
    if (!state.roomsDate) {
      const today = getTeacherRoomsDay(state.calendar?.view?.activeStart, state.calendar?.view?.activeEnd);
      state.roomsDate = today;
    }
    return startOfLocalDay(state.roomsDate);
  }

  function startOfLocalDay(date) {
    const d = new Date(date || new Date());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, amount) {
    const d = startOfLocalDay(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function getTeacherRoomsDay(start, end) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(start || today);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end || today);
    rangeEnd.setHours(0, 0, 0, 0);
    if (today >= rangeStart && today < rangeEnd) return today;
    return rangeStart;
  }

  function minutesFromTimeString(value) {
    const [hours = 0, minutes = 0] = String(value || "00:00").split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  function buildRoomSlots() {
    const startMin = minutesFromTimeString(SLOT_MIN_TIME);
    const endMin = minutesFromTimeString(SLOT_MAX_TIME);
    const slots = [];
    for (let minute = startMin; minute < endMin; minute += 30) slots.push(minute);
    return slots;
  }

  function eventStartMinutes(event) {
    const date = new Date(event.start);
    return date.getHours() * 60 + date.getMinutes();
  }

  function sameLocalDate(a, b) {
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function renderRoomSlotRow(slot, events) {
    return `
      <tr>
        <th>${escapeHTML(formatSlotLabel(slot))}</th>
        ${ROOMS.map((_, roomIndex) => renderRoomSlotCell(slot, roomIndex, events)).join("")}
      </tr>
    `;
  }

  function renderRoomSlotCell(slot, roomIndex, events) {
    const matches = events.filter((event) => {
      const assignment = event.extendedProps?.roomAssignment;
      return assignment &&
        Number(assignment.roomIndex) === roomIndex &&
        Math.floor(eventStartMinutes(event) / 30) * 30 === slot;
    });
    return `
      <td data-room-drop="${roomIndex}">
        ${matches.map(renderRoomEvent).join("")}
      </td>
    `;
  }

  function formatSlotLabel(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function renderRoomEvent(event) {
    const p = event.extendedProps || {};
    const accent = p.accentColor || DEFAULT_ACCENT;
    return `
      <button type="button" class="mcal-room__event${p.roomAssignment?.automatic ? " mcal-room__event--automatic" : ""}"
        style="--mcal-event-accent:${escapeHTML(accent)}"
        data-room-event="${escapeHTML(p.groupKey || p.bookingId || "")}"
        data-room-booking-id="${escapeHTML(p.bookingId || "")}"
        ${isAdmin && !p.roomAssignment?.automatic ? 'draggable="true"' : ""}>
        <span>${escapeHTML(formatTime(new Date(event.start)))} - ${escapeHTML(formatTime(new Date(event.end)))}</span>
        <b>${escapeHTML(p.serviceName || "Clase")}</b>
        <small>${escapeHTML(p.staffName || "")}${p.groupCount ? ` · ${escapeHTML(String(p.groupCount))} participantes` : ""}</small>
      </button>
    `;
  }

  function renderRoomListItem(event, draggable = false) {
    const p = event.extendedProps || {};
    const roomName = p.roomAssignment?.roomName || p.roomAssignment?.roomLabel || "Sin salon";
    const accent = p.accentColor || DEFAULT_ACCENT;
    return `
      <button type="button" class="mcal-room-list-item"
        style="--mcal-event-accent:${escapeHTML(accent)}"
        data-room-event="${escapeHTML(p.groupKey || p.bookingId || "")}"
        data-room-booking-id="${escapeHTML(p.bookingId || "")}"
        ${draggable && isAdmin ? 'draggable="true"' : ""}>
        <span>${escapeHTML(formatTime(new Date(event.start)))} - ${escapeHTML(formatTime(new Date(event.end)))}</span>
        <b>${escapeHTML(p.serviceName || "Clase")}</b>
        <small>${escapeHTML(roomName)} · ${escapeHTML(p.staffName || "Sin docente")}</small>
      </button>
    `;
  }

  function academicTaskTeacherOptions() {
    const teachers = new Map();
    state.bookings.forEach((booking) => {
      const teacherEmail = String(booking.staffEmail || "").trim().toLowerCase();
      if (teacherEmail) teachers.set(teacherEmail, booking.staffName || teacherEmail);
    });
    state.staffLinks.forEach((teacherEmail, teacherName) => {
      const normalizedEmail = String(teacherEmail || "").trim().toLowerCase();
      if (normalizedEmail) teachers.set(normalizedEmail, teacherName || normalizedEmail);
    });
    return [...teachers.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
      .map(([teacherEmail, teacherName]) =>
        `<option value="${escapeHTML(teacherEmail)}">${escapeHTML(teacherName)} · ${escapeHTML(teacherEmail)}</option>`
      ).join("");
  }

  function localDateInputValue(date) {
    const value = startOfLocalDay(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  function openAcademicTaskForm() {
    modalTitleEl.textContent = "Asignar tarea academica";
    modalBodyEl.innerHTML = `
      <form class="mcal-academic-task" data-academic-task-form>
        <label><span>Profesor</span><select name="staffEmail" required><option value="">Selecciona un profesor</option>${academicTaskTeacherOptions()}</select></label>
        <label><span>Fecha</span><input name="date" type="date" required value="${localDateInputValue(getRoomsSelectedDay())}"></label>
        <label><span>Hora</span><input name="time" type="time" required value="09:00"></label>
        <label><span>Duracion</span><select name="duration"><option value="30">30 minutos</option><option value="60" selected>1 hora</option><option value="90">1 hora 30</option><option value="120">2 horas</option></select></label>
        <label><span>Salon</span><select name="roomIndex" required><option value="">Selecciona un salon</option>${ROOMS.slice(0, STUDENT_LOCATION_ROOM_INDEX).map((room, index) => `<option value="${index}">${escapeHTML(room)}</option>`).join("")}</select></label>
        <p class="mcal-academic-task__status" data-academic-task-status aria-live="polite"></p>
        <button type="submit">Crear tarea</button>
      </form>`;
    modalEl.hidden = false;
    modalBodyEl.querySelector("[data-academic-task-form]")?.addEventListener("submit", saveAcademicTask);
  }

  async function saveAcademicTask(event) {
    event.preventDefault();
    if (!isAdmin) return;
    const form = event.currentTarget;
    const status = form.querySelector("[data-academic-task-status]");
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const staffEmail = String(data.get("staffEmail") || "").trim().toLowerCase();
    const staffName = String(form.elements.staffEmail.selectedOptions[0]?.textContent || staffEmail).split(" · ")[0].trim();
    const start = new Date(`${data.get("date")}T${data.get("time")}:00`);
    const duration = Number(data.get("duration") || 60);
    const roomValue = String(data.get("roomIndex") ?? "");
    const roomIndex = Number(roomValue);
    const end = new Date(start.getTime() + duration * 60000);
    if (!staffEmail || !Number.isFinite(start.getTime()) || roomValue === "" || !Number.isInteger(roomIndex)) {
      status.textContent = "Completa todos los campos.";
      return;
    }
    const conflict = hasRoomOverlap("", roomIndex, start, end);
    if (conflict) {
      status.textContent = `Cruce con ${conflict.serviceName || "otra clase"} (${formatTime(toDateSafe(conflict.startDate))}).`;
      return;
    }
    submit.disabled = true;
    status.textContent = "Guardando...";
    try {
      const bookingId = `academic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const booking = {
        bookingId,
        serviceName: "Tarea academica",
        customerName: "Actividad interna",
        staffName,
        staffEmail,
        status: "confirmed",
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        roomIndex,
        roomName: ROOMS[roomIndex],
        source: "academic-task",
        createdAt: serverTimestamp(),
        createdBy: email,
      };
      const groupKey = getGroupKey(booking) || bookingId;
      const assignment = {
        groupKey,
        bookingIds: [bookingId],
        serviceName: booking.serviceName,
        staffName,
        staffEmail,
        roomIndex,
        roomName: ROOMS[roomIndex],
        startDate: booking.startDate,
        endDate: booking.endDate,
        source: "academic-task",
        updatedAt: serverTimestamp(),
        updatedBy: email,
      };
      const batch = writeBatch(db);
      batch.set(doc(db, COLLECTION_NAME, bookingId), { ...booking, roomAssignmentGroupKey: groupKey });
      batch.set(doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey)), assignment);
      await batch.commit();
      modalEl.hidden = true;
      state.roomsDate = startOfLocalDay(start);
      setRoomsNotice("Tarea academica creada.");
    } catch (error) {
      console.error("[ReservasCalendar] No se pudo crear la tarea academica:", error);
      status.textContent = humanFirestorePermissionError(error);
      submit.disabled = false;
    }
  }

  function showEmptyMessage(msg) {
    emptyEl.hidden = false;
    emptyEl.textContent = msg;
  }

  /* ----------------- Filtros admin (UI) --------------------- */

  function refreshAdminFilterOptions() {
    const selDocente = container.querySelector("#mcal-f-docente");
    const selServicio = container.querySelector("#mcal-f-servicio");
    if (!selDocente || !selServicio) return;

    const docentes = new Map(); // email -> nombre
    const servicios = new Set();
    state.bookings.forEach((b) => {
      if (b.staffEmail) {
        docentes.set(b.staffEmail.toLowerCase(), b.staffName || b.staffEmail);
      }
      if (b.serviceName) servicios.add(b.serviceName);
    });

    rebuildSelect(selDocente, docentes, state.filters.docente, "Todos");
    rebuildSelect(
      selServicio,
      new Map([...servicios].sort().map((s) => [s, s])),
      state.filters.servicio,
      "Todos"
    );
  }

  function rebuildSelect(select, entriesMap, currentValue, allLabel) {
    const prev = currentValue;
    select.innerHTML = `<option value="">${allLabel}</option>`;
    [...entriesMap.entries()]
      .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"))
      .forEach(([value, label]) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
      });
    select.value = prev;
    if (select.value !== prev) select.value = "";
  }

  function onFilterChange() {
    const get = (id) => {
      const el = container.querySelector(id);
      return el ? el.value : "";
    };
    const previousScope = state.filters.alcance;
    state.filters = {
      alcance: get("#mcal-f-alcance") || "mine",
      docente: get("#mcal-f-docente"),
      estado: get("#mcal-f-estado"),
      servicio: get("#mcal-f-servicio"),
      especial: get("#mcal-f-especial"),
    };

    const docenteSelect = container.querySelector("#mcal-f-docente");
    if (docenteSelect) {
      docenteSelect.disabled = state.filters.alcance !== "all";
      if (docenteSelect.disabled) {
        docenteSelect.value = "";
        state.filters.docente = "";
      }
    }

    if (previousScope !== state.filters.alcance && state.calendar) {
      state.currentRangeKey = "";
      const view = state.calendar.view;
      subscribeToRange(view.activeStart, view.activeEnd);
      return;
    }

    renderEvents();
  }

  if (isAdmin) {
    container
      .querySelectorAll("#mcal-filters select")
      .forEach((sel) => sel.addEventListener("change", onFilterChange));
    container.querySelector("#mcal-csv-button")?.addEventListener("click", () => {
      container.querySelector("#mcal-csv-upload")?.click();
    });
    container.querySelector("#mcal-csv-upload")?.addEventListener("change", onCsvUpload);
    container.querySelector("#mcal-staff-settings-button")?.addEventListener("click", openStaffSettings);
    container.querySelector("#mcal-staff-settings")?.addEventListener("click", onStaffSettingsClick);
    container.querySelector("#mcal-staff-save")?.addEventListener("click", saveManualStaffLink);
    container.querySelector("#mcal-staff-apply-links")?.addEventListener("click", applyAllStaffLinksToBookings);
    container.querySelector("#mcal-user-save")?.addEventListener("click", saveHubUserAccess);
    container.querySelectorAll("#mcal-user-email, #mcal-user-label").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveHubUserAccess();
        }
      });
    });
  }

  container.querySelectorAll("[data-mcal-mode]").forEach((button) => {
    button.addEventListener("click", () => setDisplayMode(button.dataset.mcalMode || "calendar"));
  });
  roomsEl?.addEventListener("click", (event) => {
    if (event.target.closest("[data-rooms-autofill]")) {
      openAutoFillPreview();
      return;
    }
    if (event.target.closest("[data-academic-task]")) {
      openAcademicTaskForm();
      return;
    }
    const dateButton = event.target.closest("[data-rooms-date]");
    if (dateButton) {
      changeRoomsDate(dateButton.dataset.roomsDate);
      return;
    }
    const viewButton = event.target.closest("[data-rooms-view]");
    if (viewButton) {
      state.roomsView = viewButton.dataset.roomsView || "live";
      renderRoomsView();
      return;
    }
    const button = event.target.closest("[data-room-event]");
    if (!button) return;
    const key = button.dataset.roomEvent;
    const calendarEvent = state.calendar?.getEvents().find((item) => {
      const props = item.extendedProps || {};
      return props.groupKey === key || props.bookingId === key;
    });
    if (calendarEvent) {
      openDetailData({
        ...calendarEvent.extendedProps,
        startDate: calendarEvent.start,
        endDate: calendarEvent.end,
      });
    }
  });
  roomsEl?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-rooms-search]");
    if (!input) return;
    state.roomsSearch = input.value || "";
    renderRoomsView();
    const nextInput = roomsEl.querySelector("[data-rooms-search]");
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
    }
  });
  if (isAdmin) {
    roomsEl?.addEventListener("dragstart", onRoomDragStart);
    roomsEl?.addEventListener("dragover", onRoomDragOver);
    roomsEl?.addEventListener("dragleave", onRoomDragLeave);
    roomsEl?.addEventListener("drop", onRoomDrop);
  }

  function setDisplayMode(mode) {
    state.displayMode = mode === "rooms" ? "rooms" : "calendar";
    calendarEl.hidden = state.displayMode !== "calendar";
    if (roomsEl) roomsEl.hidden = state.displayMode !== "rooms";
    container.querySelectorAll("[data-mcal-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mcalMode === state.displayMode);
    });
    if (state.displayMode === "calendar") state.calendar?.updateSize();
    if (state.displayMode === "rooms") renderRoomsView();
    if (typeof onDisplayModeChange === "function") onDisplayModeChange(state.displayMode);
  }

  function onRoomDragStart(event) {
    const card = event.target.closest("[data-room-event]");
    if (!card) return;
    const payload = JSON.stringify({
      groupKey: card.dataset.roomEvent || "",
      bookingId: card.dataset.roomBookingId || "",
    });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", payload);
    event.dataTransfer.setData("text/plain", payload);
    card.classList.add("is-dragging");
  }

  function onRoomDragOver(event) {
    const dropZone = event.target.closest("[data-room-drop]");
    if (!dropZone) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dropZone.classList.add("is-drop-target");
  }

  function onRoomDragLeave(event) {
    const dropZone = event.target.closest("[data-room-drop]");
    if (!dropZone || dropZone.contains(event.relatedTarget)) return;
    dropZone.classList.remove("is-drop-target");
  }

  async function onRoomDrop(event) {
    const dropZone = event.target.closest("[data-room-drop]");
    if (!dropZone) return;
    event.preventDefault();
    roomsEl?.querySelectorAll(".is-drop-target,.is-dragging").forEach((el) => {
      el.classList.remove("is-drop-target", "is-dragging");
    });

    let payload = {};
    try {
      payload = JSON.parse(event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain") || "{}");
    } catch (_) {
      payload = {};
    }

    const target = dropZone.dataset.roomDrop;
    const roomIndex = target === "unassigned" ? null : Number(target);
    const message = await saveRoomAssignmentViaDrag(payload.groupKey, payload.bookingId, roomIndex);
    if (message) setRoomsNotice(message);
  }

  function setRoomsNotice(message) {
    const head = roomsEl?.querySelector("[data-rooms-notice]");
    if (!head) return;
    head.textContent = message;
  }

  function changeRoomsDate(action) {
    if (action === "today") {
      state.roomsDate = startOfLocalDay(new Date());
    } else {
      state.roomsDate = addDays(getRoomsSelectedDay(state.calendar?.getEvents() || []), Number(action || 0));
    }
    renderEvents();
  }

  /* --------------------- Carga CSV admin -------------------- */

  function setUploadStatus(message, isError = false) {
    const el = container.querySelector("#mcal-upload-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("mcal__upload-status--error", isError);
  }

  async function onCsvUpload(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    try {
      setUploadStatus("Leyendo CSV...");
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("El CSV no tiene filas para importar.");

      setUploadStatus("Preparando reservas...");
      const result = await importCsvRows(rows);
      setUploadStatus(
        `CSV listo: ${result.imported} reservas actualizadas y ${result.deleted} eliminadas. ${result.unmatchedStaffNames.length} docentes sin correo asociado.`
      );

      if (state.calendar) {
        state.currentRangeKey = "";
        const view = state.calendar.view;
        subscribeToRange(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error("[ReservasCalendar] Error importando CSV:", error);
      setUploadStatus(error.message || "No se pudo importar el CSV.", true);
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(value);
        value = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(value);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        value = "";
        continue;
      }

      value += char;
    }

    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    return rows;
  }

  function cleanCsvText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeHeader(value) {
    return cleanCsvText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = cleanCsvText(row[index]);
    });
    return obj;
  }

  function parseCsvDate(dateValue, timeValue) {
    const dateParts = cleanCsvText(dateValue).split(/[/-]/).map(Number);
    if (dateParts.length !== 3 || dateParts.some((part) => Number.isNaN(part))) return null;

    const [day, month, year] = dateParts;
    const [hour = 0, minute = 0] = cleanCsvText(timeValue).split(":").map(Number);
    const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseDurationMinutes(value) {
    const text = cleanCsvText(value).toLowerCase();
    const hours = Number((text.match(/(\d+)\s*h/) || [])[1] || 0);
    const minutes = Number((text.match(/(\d+)\s*min/) || [])[1] || 0);
    const total = hours * 60 + minutes;
    return total || DEFAULT_DURATION_MIN;
  }

  function normalizeStaffKey(name) {
    return cleanCsvText(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getHubUserLabel(user) {
    return cleanCsvText(
      user.label ||
      user.displayName ||
      user.name ||
      (user.especialidades && user.especialidades.label) ||
      ""
    );
  }

  function makeCsvBookingId(row) {
    const raw = [
      row["session date"],
      row["start time"],
      row["booking contact email"],
      row["service name"],
      row["staff name"],
    ].join("|");
    return `csv_${normalizeStaffKey(raw).slice(0, 140)}`;
  }

  async function loadStaffEmailMap(staffNames) {
    const entries = new Map();

    const hubUsersSnap = await getDocs(collection(db, "hubUsers"));
    const hubUsersByName = new Map();
    hubUsersSnap.forEach((userDoc) => {
      const user = userDoc.data();
      const email = String(user.email || userDoc.id || "").trim().toLowerCase();
      const names = [
        getHubUserLabel(user),
        userDoc.id,
        email,
      ];

      names.forEach((name) => {
        const key = normalizeStaffKey(name);
        if (key && email) hubUsersByName.set(key, email);
      });
    });

    await Promise.all([...staffNames].map(async (staffName) => {
      const key = normalizeStaffKey(staffName);
      if (!key) return;

      const hubEmail = hubUsersByName.get(key);
      if (hubEmail) {
        entries.set(staffName, hubEmail);
        return;
      }

      const snap = await getDoc(doc(db, "wixStaffMap", key));
      if (snap.exists() && snap.data().staffEmail) {
        entries.set(staffName, String(snap.data().staffEmail).trim().toLowerCase());
      }
    }));

    return entries;
  }

  async function loadHubTeacherOptions() {
    const snap = await getDocs(collection(db, "hubUsers"));
    const byEmail = new Map([
      ["catalina.medina.leal@gmail.com", { email: "catalina.medina.leal@gmail.com", label: "Catalina Medina" }],
      ["alekcaballeromusic@gmail.com", { email: "alekcaballeromusic@gmail.com", label: "Alek Caballero" }],
    ]);
    snap.forEach((userDoc) => {
      const user = userDoc.data();
      const email = String(user.email || userDoc.id || "").trim().toLowerCase();
      if (!email) return;
      byEmail.set(email, {
        email,
        label: getHubUserLabel(user) || email,
      });
    });
    return [...byEmail.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function setStaffSettingsStatus(message, isError = false) {
    const el = container.querySelector("#mcal-staff-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("mcal-settings__status--error", isError);
  }

  async function openStaffSettings() {
    const panel = container.querySelector("#mcal-staff-settings");
    if (!panel) return;
    panel.hidden = false;
    setStaffSettingsStatus("Cargando docentes...");

    try {
      const teachers = await loadHubTeacherOptions();
      const select = container.querySelector("#mcal-staff-email");
      if (select) {
        select.innerHTML = `<option value="">Seleccionar correo...</option>`;
        teachers.forEach((teacher) => {
          const opt = document.createElement("option");
          opt.value = teacher.email;
          opt.textContent = `${teacher.label} - ${teacher.email}`;
          select.appendChild(opt);
        });
      }

      await renderUnmatchedStaffList(teachers);
      await renderLinkedStaffList(teachers);
      setStaffSettingsStatus("Selecciona un nombre pendiente o crea un vínculo manual.");
    } catch (error) {
      console.error("[ReservasCalendar] Error cargando ajustes docentes:", error);
      setStaffSettingsStatus(error.message || "No se pudieron cargar los ajustes.", true);
    }
  }

  function closeStaffSettings() {
    const panel = container.querySelector("#mcal-staff-settings");
    if (panel) panel.hidden = true;
  }

  function onStaffSettingsClick(event) {
    if (event.target.closest("[data-mcal-settings-close]")) {
      closeStaffSettings();
      return;
    }

    const pickButton = event.target.closest("[data-staff-name]");
    if (!pickButton) return;
    const input = container.querySelector("#mcal-staff-name");
    if (input) input.value = pickButton.dataset.staffName || "";
  }

  async function updatePendingStaffBadge() {
    const badge = container.querySelector("#mcal-staff-pending-badge");
    if (!badge) return;
    try {
      const snap = await getDocs(collection(db, "wixStaffUnmatched"));
      let count = 0;
      snap.forEach((docSnap) => {
        if (docSnap.data().status !== "linked") count += 1;
      });
      if (count > 0) {
        badge.textContent = String(count);
        badge.hidden = false;
        badge.title = `${count} docente(s) sin vincular`;
      } else {
        badge.hidden = true;
      }
    } catch (_) {
      /* silencioso: el badge es informativo */
    }
  }

  async function renderUnmatchedStaffList(teachers) {
    const list = container.querySelector("#mcal-staff-unmatched");
    if (!list) return;

    const snap = await getDocs(collection(db, "wixStaffUnmatched"));
    const items = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "linked") return;
      items.push({ id: docSnap.id, ...data });
    });
    updatePendingStaffBadge();

    if (!items.length) {
      list.innerHTML = `<p class="mcal-settings__empty">No hay docentes pendientes por vincular.</p>`;
      return;
    }

    const teacherOptions = teachers
      .map((teacher) => `<option value="${escapeHTML(teacher.email)}">${escapeHTML(teacher.label)} - ${escapeHTML(teacher.email)}</option>`)
      .join("");

    list.innerHTML = items
      .sort((a, b) => String(a.staffName).localeCompare(String(b.staffName), "es"))
      .map((item) => `
        <article class="mcal-settings__item">
          <div>
            <strong>${escapeHTML(item.staffName || item.id)}</strong>
            <span>${Number(item.occurrences || 0)} reservas importadas</span>
          </div>
          <button type="button" data-staff-name="${escapeHTML(item.staffName || "")}">Usar nombre</button>
          <select data-inline-email>
            <option value="">Seleccionar correo...</option>
            ${teacherOptions}
          </select>
          <button type="button" data-inline-save data-staff-name="${escapeHTML(item.staffName || "")}">Vincular</button>
        </article>
      `)
      .join("");

    list.querySelectorAll("[data-inline-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = button.closest(".mcal-settings__item");
        const email = item?.querySelector("[data-inline-email]")?.value || "";
        await saveStaffLink(button.dataset.staffName || "", email);
      });
    });
    list.querySelectorAll("[data-inline-email]").forEach((select) => {
      select.addEventListener("change", async () => {
        const item = select.closest(".mcal-settings__item");
        const staffName = item?.querySelector("[data-inline-save]")?.dataset.staffName || "";
        if (select.value) await saveStaffLink(staffName, select.value);
      });
    });
  }

  async function renderLinkedStaffList(teachers) {
    const list = container.querySelector("#mcal-staff-linked");
    if (!list) return;

    const snap = await getDocs(collection(db, "wixStaffMap"));
    const items = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({ id: docSnap.id, ...data });
    });

    if (!items.length) {
      list.innerHTML = `<p class="mcal-settings__empty">Todavía no hay vínculos guardados.</p>`;
      return;
    }

    const teacherOptions = teachers
      .map((teacher) => `<option value="${escapeHTML(teacher.email)}">${escapeHTML(teacher.label)} - ${escapeHTML(teacher.email)}</option>`)
      .join("");

    list.innerHTML = items
      .sort((a, b) => String(a.staffName).localeCompare(String(b.staffName), "es"))
      .map((item) => `
        <article class="mcal-settings__item">
          <div>
            <strong>${escapeHTML(item.staffName || item.id)}</strong>
            <span>${escapeHTML(item.staffEmail || "Sin correo")}</span>
          </div>
          <button type="button" data-staff-name="${escapeHTML(item.staffName || "")}">Editar</button>
          <select data-inline-email>
            <option value="">Seleccionar correo...</option>
            ${teacherOptions}
          </select>
          <button type="button" data-inline-save data-staff-name="${escapeHTML(item.staffName || "")}">Actualizar</button>
        </article>
      `)
      .join("");

    list.querySelectorAll("[data-inline-email]").forEach((select) => {
      const item = select.closest(".mcal-settings__item");
      const staffName = item?.querySelector("[data-inline-save]")?.dataset.staffName || "";
      const current = items.find((entry) => entry.staffName === staffName);
      if (current?.staffEmail) select.value = String(current.staffEmail).toLowerCase();
    });

    list.querySelectorAll("[data-inline-save]").forEach((button) => {
      button.addEventListener("click", async () => {
        const item = button.closest(".mcal-settings__item");
        const email = item?.querySelector("[data-inline-email]")?.value || "";
        await saveStaffLink(button.dataset.staffName || "", email);
      });
    });
    list.querySelectorAll("[data-inline-email]").forEach((select) => {
      select.addEventListener("change", async () => {
        const item = select.closest(".mcal-settings__item");
        const staffName = item?.querySelector("[data-inline-save]")?.dataset.staffName || "";
        if (select.value) await saveStaffLink(staffName, select.value);
      });
    });
  }

  async function saveManualStaffLink() {
    const staffName = container.querySelector("#mcal-staff-name")?.value || "";
    const staffEmail = container.querySelector("#mcal-staff-email")?.value || "";
    await saveStaffLink(staffName, staffEmail);
  }

  async function saveStaffLink(staffName, staffEmail) {
    const cleanName = cleanCsvText(staffName);
    const cleanEmail = String(staffEmail || "").trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      setStaffSettingsStatus("Falta nombre de Wix o correo del Hub.", true);
      return;
    }

    const key = normalizeStaffKey(cleanName);
    await setDoc(doc(db, "wixStaffMap", key), {
      staffName: cleanName,
      staffEmail: cleanEmail,
      enabled: true,
      source: "admin-settings",
      updatedAt: serverTimestamp(),
      updatedBy: email,
    }, { merge: true });

    await setDoc(doc(db, "wixStaffUnmatched", key), {
      staffName: cleanName,
      normalizedName: key,
      status: "linked",
      linkedEmail: cleanEmail,
      updatedAt: serverTimestamp(),
      updatedBy: email,
    }, { merge: true });

    const updatedBookings = await updateExistingBookingsForStaff(cleanName, cleanEmail);

    setStaffSettingsStatus(
      `Vínculo guardado: ${cleanName} -> ${cleanEmail}. ${updatedBookings} reservas actualizadas.`
    );
    const teachers = await loadHubTeacherOptions();
    await renderUnmatchedStaffList(teachers);
    await renderLinkedStaffList(teachers);

    if (state.calendar) {
      state.currentRangeKey = "";
      const view = state.calendar.view;
      subscribeToRange(view.activeStart, view.activeEnd);
    }
  }

  async function updateExistingBookingsForStaff(staffName, staffEmail) {
    const targetKey = normalizeStaffKey(staffName);
    if (!targetKey || !staffEmail) return 0;

    const snap = await getDocs(collection(db, COLLECTION_NAME));
    let batch = writeBatch(db);
    let batchCount = 0;
    let updated = 0;

    async function commitIfNeeded(force = false) {
      if (batchCount > 0 && (force || batchCount >= CSV_BATCH_SIZE)) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    for (const bookingDoc of snap.docs) {
      const booking = bookingDoc.data();
      if (normalizeStaffKey(booking.staffName) !== targetKey) continue;
      if (String(booking.staffEmail || "").toLowerCase() === staffEmail) continue;

      batch.set(bookingDoc.ref, {
        staffEmail,
        staffLinkedFromName: staffName,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batchCount += 1;
      updated += 1;
      await commitIfNeeded();
    }

    await commitIfNeeded(true);
    return updated;
  }

  async function applyAllStaffLinksToBookings() {
    try {
      setStaffSettingsStatus("Aplicando vínculos a reservas existentes...");
      await refreshStaffLinks();

      const snap = await getDocs(collection(db, COLLECTION_NAME));
      let batch = writeBatch(db);
      let batchCount = 0;
      let updated = 0;

      async function commitIfNeeded(force = false) {
        if (batchCount > 0 && (force || batchCount >= CSV_BATCH_SIZE)) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      for (const bookingDoc of snap.docs) {
        const booking = bookingDoc.data();
        const linkedEmail = state.staffLinks.get(normalizeStaffKey(booking.staffName));
        if (!linkedEmail) continue;
        if (String(booking.staffEmail || "").toLowerCase() === linkedEmail) continue;

        batch.set(bookingDoc.ref, {
          staffEmail: linkedEmail,
          staffLinkedFromName: booking.staffName || "",
          updatedAt: serverTimestamp(),
        }, { merge: true });
        batchCount += 1;
        updated += 1;
        await commitIfNeeded();
      }

      await commitIfNeeded(true);
      setStaffSettingsStatus(`${updated} reservas actualizadas con vínculos guardados.`);

      if (state.calendar) {
        state.currentRangeKey = "";
        const view = state.calendar.view;
        subscribeToRange(view.activeStart, view.activeEnd);
      }
    } catch (error) {
      console.error("[ReservasCalendar] Error aplicando vínculos:", error);
      setStaffSettingsStatus(error.message || "No se pudieron aplicar los vínculos.", true);
    }
  }

  async function saveHubUserAccess() {
    const userEmailInput = container.querySelector("#mcal-user-email");
    const userLabelInput = container.querySelector("#mcal-user-label");
    const newEmail = String(userEmailInput?.value || "").trim().toLowerCase();
    const label = cleanCsvText(userLabelInput?.value || "");

    if (!newEmail || !newEmail.includes("@")) {
      setStaffSettingsStatus("Escribe un correo válido para el acceso.", true);
      return;
    }

    await setDoc(doc(db, "hubUsers", newEmail), {
      email: newEmail,
      enabled: true,
      label: label || newEmail,
      updatedAt: serverTimestamp(),
      updatedBy: email,
    }, { merge: true });

    if (userEmailInput) userEmailInput.value = "";
    if (userLabelInput) userLabelInput.value = "";

    setStaffSettingsStatus(`Acceso creado/activado para ${newEmail}.`);
    await openStaffSettings();
  }

  function writeUnmatchedStaffAlert(batch, staffName, count) {
    const key = normalizeStaffKey(staffName);
    if (!key) return 0;

    batch.set(doc(db, "wixStaffUnmatched", key), {
      staffName,
      normalizedName: key,
      occurrences: count,
      source: "csv-emergency",
      status: "pending",
      message: "No se encontro un correo asociado en hubUsers ni en wixStaffMap.",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return 1;
  }

  async function importCsvRows(rows) {
    const headers = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(1).map((row) => rowToObject(headers, row));
    const staffNames = new Set(dataRows.map((row) => row["staff name"]).filter(Boolean));
    const staffEmailMap = await loadStaffEmailMap(staffNames);

    let batch = writeBatch(db);
    let batchCount = 0;
    let imported = 0;
    let deleted = 0;
    const unmatchedCounts = new Map();
    const incomingBookingIds = new Set();
    const incomingGroupKeys = new Set();

    async function commitIfNeeded(force = false) {
      if (batchCount > 0 && (force || batchCount >= CSV_BATCH_SIZE)) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    for (const row of dataRows) {
      const start = parseCsvDate(row["session date"], row["start time"]);
      if (!start) continue;

      const duration = parseDurationMinutes(row["duracion"]);
      const end = new Date(start.getTime() + duration * 60000);
      const staffName = row["staff name"];
      const staffEmail = staffEmailMap.get(staffName) || "";
      if (!staffEmail) unmatchedCounts.set(staffName, (unmatchedCounts.get(staffName) || 0) + 1);

      const bookingId = makeCsvBookingId(row);
      incomingBookingIds.add(bookingId);
      incomingGroupKeys.add([
        start.getFullYear(),
        start.getMonth() + 1,
        start.getDate(),
        start.getHours(),
        start.getMinutes(),
        normalizeGroupText(row["service name"]),
        normalizeGroupText(staffEmail || staffName),
      ].join("|"));
      const ref = doc(db, COLLECTION_NAME, bookingId);
      batch.set(ref, {
        bookingId,
        serviceName: row["service name"],
        serviceType: row["service type"],
        staffName,
        staffEmail,
        customerName: row["booking contact name"],
        customerEmail: String(row["booking contact email"] || "").toLowerCase(),
        customerPhone: row["booking contact phone"],
        studentEmails: row["booking contact email"] ? [String(row["booking contact email"]).toLowerCase()] : [],
        studentLookupKey: String(row["booking contact email"] || "").toLowerCase(),
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        startDateRaw: `${row["session date"]} ${row["start time"]}`,
        endDateRaw: end.toISOString(),
        status: row["booking status"] || "confirmed",
        attendanceStatus: row["attendance status"],
        paymentStatus: row["payment status"],
        location: row["client address"],
        participantsCount: Number(row["plazas reservadas"] || 1),
        source: "csv-emergency",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batchCount += 1;
      imported += 1;
      await commitIfNeeded();
    }

    deleted = await deleteMissingCsvEmergencyBookings(incomingBookingIds, incomingGroupKeys);

    for (const [staffName, count] of unmatchedCounts.entries()) {
      batchCount += writeUnmatchedStaffAlert(batch, staffName, count);
      await commitIfNeeded();
    }

    await commitIfNeeded(true);
    return { imported, deleted, unmatchedStaffNames: [...unmatchedCounts.keys()] };
  }

  async function deleteMissingCsvEmergencyBookings(incomingBookingIds, incomingGroupKeys) {
    const snap = await getDocs(query(
      collection(db, COLLECTION_NAME),
      where("source", "==", "csv-emergency")
    ));

    let batch = writeBatch(db);
    let batchCount = 0;
    let deleted = 0;

    async function commitIfNeeded(force = false) {
      if (batchCount > 0 && (force || batchCount >= CSV_BATCH_SIZE)) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    for (const docSnap of snap.docs) {
      const bookingId = docSnap.id;
      if (incomingBookingIds.has(bookingId)) continue;

      const booking = docSnap.data();
      const groupKey = getGroupKey({ ...booking, _docId: bookingId }) || booking.roomAssignmentGroupKey || bookingId;

      batch.delete(doc(db, COLLECTION_NAME, bookingId));
      batchCount += 1;
      if (groupKey && !incomingGroupKeys.has(groupKey)) {
        batch.delete(doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey)));
        batchCount += 1;
      }
      deleted += 1;
      await commitIfNeeded();
    }

    await commitIfNeeded(true);
    return deleted;
  }

  /* -------------------- Modal de detalle -------------------- */

  function openDetail(bookingId) {
    const b = state.bookings.get(bookingId) ||
      [...state.bookings.values()].find((x) => x.bookingId === bookingId);
    if (!b) return;
    openDetailData(b);
  }

  function openDetailData(b) {
    const start = getBookingStart(b);
    const end = getBookingEnd(b, start);
    const statusKey = normalizeStatus(b.status);
    const updatedAt = toDateSafe(b.updatedAt);
    const groupKey = b.groupKey || getGroupKey(b) || b.bookingId || b._docId;
    const roomAssignment = b.roomAssignment || getAutomaticRoomAssignment(b, groupKey) || state.roomAssignments.get(groupKey);

    modalTitleEl.textContent = b.serviceName || "Detalle de reserva";

    const rows = [];
    const row = (label, value, opts = {}) => {
      if (value === null || value === undefined || value === "") return;
      rows.push(`
        <div class="mcal-modal__row${opts.full ? " mcal-modal__row--full" : ""}">
          <dt>${escapeHTML(label)}</dt>
          <dd>${opts.html ? value : escapeHTML(value)}</dd>
        </div>`);
    };

    row("Estado", `<span class="mcal__chip mcal__chip--${statusKey}">${STATUS_LABELS[statusKey]}</span>`, { html: true });
    row("Estudiante / grupo", b.isGroup ? `${b.groupCount} participantes` : b.customerName);
    row("Docente", b.staffName || b.staffEmail || "Sin asignar");
    row("Fecha", start ? start.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—");
    row("Hora inicio", formatTime(start));
    row("Hora fin", formatTime(end));
    row("Ubicación", b.location);
    row("Salón", roomAssignment?.roomName || roomAssignment?.roomLabel || "Sin asignar");
    if (b.source === "academic-task") {
      row("Bitácora académica", `<a class="mcal-academic-log-link" href="${ACADEMIC_LOG_URL}" target="_blank" rel="noopener noreferrer">Abrir Bitácora Académica</a>`, { full: true, html: true });
      if (isAdmin) {
        row("Administrar", `<button type="button" class="mcal-academic-task-delete" data-academic-task-delete data-booking-id="${escapeHTML(b.bookingId || b._docId || "")}" data-group-key="${escapeHTML(groupKey)}">Eliminar tarea académica</button><span class="mcal-room-assign__status" data-academic-delete-status></span>`, { full: true, html: true });
      }
    }
    if (b.participantsCount !== undefined && b.participantsCount !== null) {
      row("Participantes", String(b.isGroup ? b.groupCount : b.participantsCount));
    }
    if (b.source === "academic-task") {
      // Las tareas academicas pertenecen al docente, no a un estudiante.
    } else if (b.isGroup && Array.isArray(b.participants)) {
      row("Lista de participantes", renderParticipantsList(b.participants), { full: true, html: true });
    } else {
      row("Acceso del estudiante", renderStudentActions({
        email: Array.isArray(b.studentEmails) && b.studentEmails.length
          ? b.studentEmails[0]
          : b.customerEmail,
      }), { full: true, html: true });
    }
    row("Última actualización", formatDateTime(updatedAt));
    if (isAdmin && !roomAssignment?.automatic) {
      row("Asignar salón", renderRoomAssignmentControl(b, groupKey, roomAssignment), { full: true, html: true });
    }

    modalBodyEl.innerHTML = `<dl class="mcal-modal__grid">${rows.join("")}</dl>`;
    modalEl.hidden = false;
    document.addEventListener("keydown", onEscClose);
  }

  function getSourceLabel(source) {
    if (source === "csv-emergency") return "CSV emergencia";
    if (source === "wix") return "Wix automatización";
    return source || "Sin origen";
  }

  function renderParticipantsList(participants) {
    const items = uniqueParticipants(participants)
      .map((participant) => `
        <li>
          <strong>${escapeHTML(participant.name || "Estudiante")}</strong>
          ${renderStudentActions(participant)}
        </li>`)
      .join("");
    return `<ul class="mcal-participants">${items}</ul>`;
  }

  function renderStudentActions(participant) {
    const email = String(participant.email || "").trim().toLowerCase();
    if (!email) {
      return `<span class="mcal-participants__missing">Sin correo para vincular</span>`;
    }

    const encodedEmail = encodeURIComponent(email);
    return `
      <span class="mcal-participants__actions">
        <button type="button" data-student-view="profile" data-student-email="${encodedEmail}">Ver perfil</button>
        <button type="button" data-student-view="journal" data-student-email="${encodedEmail}">Ver bitácoras</button>
      </span>`;
  }

  function renderRoomAssignmentControl(booking, groupKey, assignment) {
    const current = assignment?.roomIndex ?? "";
    return `
      <div class="mcal-room-assign">
        <select data-room-select data-group-key="${escapeHTML(groupKey)}">
          <option value="">Sin asignar</option>
          ${ROOMS.map((room, index) => index === STUDENT_LOCATION_ROOM_INDEX ? "" : `
            <option value="${index}" ${String(current) === String(index) ? "selected" : ""}>${escapeHTML(room)}</option>
          `).join("")}
        </select>
        <button type="button"
          data-room-save
          data-group-key="${escapeHTML(groupKey)}"
          data-booking-id="${escapeHTML(booking.bookingId || booking._docId || "")}">
          Guardar salón
        </button>
        <span class="mcal-room-assign__status" data-room-status></span>
      </div>`;
  }

  function closeDetail() {
    modalEl.hidden = true;
    document.removeEventListener("keydown", onEscClose);
  }

  function onEscClose(e) {
    if (e.key === "Escape") closeDetail();
  }

  async function onModalClick(e) {
    if (e.target.closest("[data-mcal-close]")) closeDetail();
    const deleteTaskButton = e.target.closest("[data-academic-task-delete]");
    if (deleteTaskButton) {
      await deleteAcademicTask(deleteTaskButton);
      return;
    }
    const roomButton = e.target.closest("[data-room-save]");
    if (roomButton) {
      await saveRoomAssignmentFromModal(roomButton);
      return;
    }
    const studentButton = e.target.closest("[data-student-view]");
    if (!studentButton) return;

    const email = decodeURIComponent(studentButton.dataset.studentEmail || "");
    const view = studentButton.dataset.studentView;
    if (typeof loadStudentHubData !== "function") return;

    studentButton.disabled = true;
    const originalText = studentButton.textContent;
    studentButton.textContent = "Cargando...";

    try {
      const data = await loadStudentHubData(email);
      if (view === "profile") renderStudentProfile(data.student, email);
      else renderStudentJournal(data.student, data.bitacoras, email);
    } catch (error) {
      modalTitleEl.textContent = "No se pudo cargar";
      modalBodyEl.innerHTML = `<p class="mcal-student-empty">${escapeHTML(
        error?.message || "Revisa el acceso al proyecto de bitácoras."
      )}</p>`;
    } finally {
      studentButton.disabled = false;
      studentButton.textContent = originalText;
    }
  }

  async function deleteAcademicTask(button) {
    if (!isAdmin) return;
    const bookingId = button.dataset.bookingId || "";
    const groupKey = button.dataset.groupKey || bookingId;
    const status = button.parentElement?.querySelector("[data-academic-delete-status]");
    if (!bookingId || !window.confirm("¿Eliminar esta tarea académica y liberar el salón?")) return;
    button.disabled = true;
    if (status) status.textContent = "Eliminando...";
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTION_NAME, bookingId));
      batch.delete(doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey)));
      await batch.commit();
      state.bookings.delete(bookingId);
      state.roomAssignments.delete(groupKey);
      closeDetail();
      renderEvents();
    } catch (error) {
      console.error("[ReservasCalendar] No se pudo eliminar la tarea académica:", error);
      if (status) status.textContent = humanFirestorePermissionError(error);
      button.disabled = false;
    }
  }

  function roomAssignmentDocId(groupKey) {
    return encodeURIComponent(String(groupKey || "sin-grupo")).replace(/\./g, "%2E");
  }

  function getBookingsForGroup(groupKey, fallbackBookingId = "") {
    const items = [...state.bookings.values()].filter((booking) => {
      const key = getGroupKey(booking) || booking.bookingId || booking._docId;
      return key === groupKey || booking.bookingId === fallbackBookingId || booking._docId === fallbackBookingId;
    });
    return items;
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function hasRoomOverlap(groupKey, roomIndex, start, end) {
    if (Number(roomIndex) === STUDENT_LOCATION_ROOM_INDEX) return null;
    for (const assignment of state.roomAssignments.values()) {
      if (!assignment || assignment.groupKey === groupKey) continue;
      if (Number(assignment.roomIndex) !== Number(roomIndex)) continue;
      const otherStart = toDateSafe(assignment.startDate);
      const otherEnd = toDateSafe(assignment.endDate);
      if (otherStart && otherEnd && rangesOverlap(start, end, otherStart, otherEnd)) return assignment;
    }
    return null;
  }

  async function saveRoomAssignmentFromModal(button) {
    if (!isAdmin) return;
    const groupKey = button.dataset.groupKey || "";
    const bookingId = button.dataset.bookingId || "";
    const wrapper = button.closest(".mcal-room-assign");
    const select = wrapper?.querySelector("[data-room-select]");
    const statusEl = wrapper?.querySelector("[data-room-status]");
    const roomValue = select?.value ?? "";
    const bookings = getBookingsForGroup(groupKey, bookingId);
    const base = bookings[0];
    if (!base) {
      if (statusEl) statusEl.textContent = "No encontré la reserva visible.";
      return;
    }

    if (isStudentLocationClass(base)) {
      if (statusEl) statusEl.textContent = "Las clases MH se asignan automaticamente a Ubicacion del estudiante.";
      return;
    }

    const start = getBookingStart(base);
    const end = getBookingEnd(base, start);
    if (!start || !end) {
      if (statusEl) statusEl.textContent = "La reserva no tiene horario válido.";
      return;
    }

    button.disabled = true;
    if (statusEl) statusEl.textContent = "Guardando...";

    try {
      const ref = doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey));
      if (roomValue === "") {
        await deleteDoc(ref);
        let batch = writeBatch(db);
        bookings.forEach((booking) => {
          batch.set(doc(db, COLLECTION_NAME, booking._docId || booking.bookingId), {
            roomIndex: null,
            roomName: "",
            roomAssignedAt: serverTimestamp(),
            roomAssignedBy: email,
          }, { merge: true });
        });
        await batch.commit();
        state.roomAssignments.delete(groupKey);
        bookings.forEach((booking) => {
          booking.roomIndex = null;
          booking.roomName = "";
        });
        if (statusEl) statusEl.textContent = "Salón quitado.";
        renderEvents();
        return;
      }

      const roomIndex = Number(roomValue);
      if (roomIndex === STUDENT_LOCATION_ROOM_INDEX) {
        if (statusEl) statusEl.textContent = "Ubicacion del estudiante se reserva para clases MH.";
        return;
      }
      const conflict = hasRoomOverlap(groupKey, roomIndex, start, end);
      if (conflict) {
        if (statusEl) {
          statusEl.textContent = `Cruce con ${conflict.serviceName || "otra clase"} (${formatTime(toDateSafe(conflict.startDate))}).`;
        }
        return;
      }

      const payload = {
        groupKey,
        bookingIds: bookings.map((booking) => booking.bookingId || booking._docId).filter(Boolean),
        serviceName: base.serviceName || "",
        staffName: base.staffName || "",
        staffEmail: base.staffEmail || "",
        roomIndex,
        roomName: ROOMS[roomIndex],
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
        source: "reservas-calendar",
        updatedAt: serverTimestamp(),
        updatedBy: email,
      };
      await setDoc(ref, payload, { merge: true });
      let batch = writeBatch(db);
      bookings.forEach((booking) => {
        batch.set(doc(db, COLLECTION_NAME, booking._docId || booking.bookingId), {
          roomIndex,
          roomName: ROOMS[roomIndex],
          roomAssignmentGroupKey: groupKey,
          roomAssignedAt: serverTimestamp(),
          roomAssignedBy: email,
        }, { merge: true });
      });
      await batch.commit();
      state.roomAssignments.set(groupKey, { ...payload, id: roomAssignmentDocId(groupKey) });
      bookings.forEach((booking) => {
        booking.roomIndex = roomIndex;
        booking.roomName = ROOMS[roomIndex];
        booking.roomAssignmentGroupKey = groupKey;
      });
      if (statusEl) statusEl.textContent = "Salón guardado.";
      renderEvents();
    } catch (error) {
      console.error("[ReservasCalendar] Error guardando salón:", error);
      if (statusEl) statusEl.textContent = humanFirestorePermissionError(error);
    } finally {
      button.disabled = false;
    }
  }

  async function saveRoomAssignmentViaDrag(groupKey, bookingId, roomIndex) {
    if (!isAdmin) return "Solo admin puede mover salones.";
    const bookings = getBookingsForGroup(groupKey, bookingId);
    const base = bookings[0];
    if (!base) return "No encontre la reserva visible.";
    if (isStudentLocationClass(base)) {
      return "Las clases MH se asignan automaticamente a Ubicacion del estudiante.";
    }

    const start = getBookingStart(base);
    const end = getBookingEnd(base, start);
    if (!start || !end) return "La reserva no tiene horario valido.";

    const ref = doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey));
    if (roomIndex === null || roomIndex === undefined || roomIndex === "") {
      await deleteDoc(ref);
      const batch = writeBatch(db);
      bookings.forEach((booking) => {
        batch.set(doc(db, COLLECTION_NAME, booking._docId || booking.bookingId), {
          roomIndex: null,
          roomName: "",
          roomAssignedAt: serverTimestamp(),
          roomAssignedBy: email,
        }, { merge: true });
      });
      await batch.commit();
      state.roomAssignments.delete(groupKey);
      bookings.forEach((booking) => {
        booking.roomIndex = null;
        booking.roomName = "";
      });
      renderEvents();
      return "Salon quitado.";
    }

    const numericRoomIndex = Number(roomIndex);
    if (!Number.isInteger(numericRoomIndex) || numericRoomIndex < 0 || numericRoomIndex >= ROOMS.length) {
      return "Salon invalido.";
    }
    if (numericRoomIndex === STUDENT_LOCATION_ROOM_INDEX) {
      return "Ubicacion del estudiante se reserva para clases MH.";
    }

    const conflict = hasRoomOverlap(groupKey, numericRoomIndex, start, end);
    if (conflict) {
      return `Cruce con ${conflict.serviceName || "otra clase"} (${formatTime(toDateSafe(conflict.startDate))}).`;
    }

    const payload = {
      groupKey,
      bookingIds: bookings.map((booking) => booking.bookingId || booking._docId).filter(Boolean),
      serviceName: base.serviceName || "",
      staffName: base.staffName || "",
      staffEmail: base.staffEmail || "",
      roomIndex: numericRoomIndex,
      roomName: ROOMS[numericRoomIndex],
      startDate: Timestamp.fromDate(start),
      endDate: Timestamp.fromDate(end),
      source: "reservas-calendar",
      updatedAt: serverTimestamp(),
      updatedBy: email,
    };
    await setDoc(ref, payload, { merge: true });

    const batch = writeBatch(db);
    bookings.forEach((booking) => {
      batch.set(doc(db, COLLECTION_NAME, booking._docId || booking.bookingId), {
        roomIndex: numericRoomIndex,
        roomName: ROOMS[numericRoomIndex],
        roomAssignmentGroupKey: groupKey,
        roomAssignedAt: serverTimestamp(),
        roomAssignedBy: email,
      }, { merge: true });
    });
    await batch.commit();

    state.roomAssignments.set(groupKey, { ...payload, id: roomAssignmentDocId(groupKey) });
    bookings.forEach((booking) => {
      booking.roomIndex = numericRoomIndex;
      booking.roomName = ROOMS[numericRoomIndex];
      booking.roomAssignmentGroupKey = groupKey;
    });
    renderEvents();
    return `Salon guardado: ${ROOMS[numericRoomIndex]}.`;
  }

  /* ------------------ Relleno automático de salones ------------------ */

  /**
   * Calcula una propuesta de salones para las clases del día visible que aún
   * NO tienen salón. Respeta las asignaciones existentes (manuales o MH) y
   * evita cruces de horario dentro de cada salón.
   */
  function computeRoomAutoFill() {
    const events = buildRoomsEvents();
    const day = getRoomsSelectedDay(events);
    const dayEvents = events.filter((e) => sameLocalDate(new Date(e.start), day));

    /* Ocupación inicial: clases que ya tienen salón (se respetan). */
    const occupancy = new Map(); // roomIndex -> [{ start, end }]
    const addOcc = (roomIndex, start, end) => {
      if (!occupancy.has(roomIndex)) occupancy.set(roomIndex, []);
      occupancy.get(roomIndex).push({ start, end });
    };
    dayEvents.forEach((e) => {
      const asg = e.extendedProps?.roomAssignment;
      const ri = Number(asg?.roomIndex);
      if (asg && Number.isInteger(ri)) addOcc(ri, new Date(e.start), new Date(e.end));
    });

    /* Candidatas: las que no tienen salón asignado (ni automático MH). */
    const candidates = dayEvents.filter((e) => !e.extendedProps?.roomAssignment);

    const enriched = candidates.map((e) => {
      const p = e.extendedProps || {};
      const cls = classifyRoomCategory({
        serviceName: p.serviceName,
        participantsCount: p.participantsCount,
        modality: p.modality,
        staffName: p.staffName,
        staffEmail: p.staffEmail,
      });
      return { event: e, start: new Date(e.start), end: new Date(e.end), ...cls };
    });

    /* Se asignan primero las de menor peso (más prioritarias), luego por hora. */
    enriched.sort((a, b) => a.weight - b.weight || a.start - b.start);

    const overlaps = (list, s, en) => (list || []).some((o) => o.start < en && s < o.end);
    const proposals = [];
    const unplaced = [];
    enriched.forEach((item) => {
      const roomIndex = item.rooms.find((r) => !overlaps(occupancy.get(r), item.start, item.end));
      if (roomIndex === undefined) {
        unplaced.push(item);
        return;
      }
      addOcc(roomIndex, item.start, item.end);
      proposals.push({ item, roomIndex });
    });

    return { day, proposals, unplaced, totalCandidates: candidates.length };
  }

  function autoFillRoomOptions(selectedIndex) {
    const options = [`<option value="">Sin salón</option>`];
    for (let i = 0; i < STUDENT_LOCATION_ROOM_INDEX; i += 1) {
      options.push(`<option value="${i}"${Number(selectedIndex) === i ? " selected" : ""}>${escapeHTML(ROOMS[i])}</option>`);
    }
    return options.join("");
  }

  function autoFillRow(item, suggestedIndex) {
    const p = item.event.extendedProps || {};
    const groupKey = p.groupKey || p.bookingId || "";
    return `
      <div class="mcal-autofill__row" data-autofill-row>
        <div class="mcal-autofill__info">
          <span class="mcal-autofill__time">${escapeHTML(formatTime(item.start))}</span>
          <span class="mcal-autofill__svc">${escapeHTML(p.serviceName || "Clase")}</span>
          <span class="mcal-autofill__staff">${escapeHTML(p.staffName || "Sin docente")}</span>
        </div>
        <select class="mcal-autofill__select" data-autofill-select data-group-key="${escapeHTML(groupKey)}">
          ${autoFillRoomOptions(suggestedIndex)}
        </select>
      </div>`;
  }

  function openAutoFillPreview() {
    if (!isAdmin) return;
    const { day, proposals, unplaced, totalCandidates } = computeRoomAutoFill();

    /* Todas las candidatas juntas, ordenadas por hora. La sugerencia queda
       preseleccionada en cada selector, pero el admin puede cambiarla. */
    const rows = [
      ...proposals.map((pr) => ({ item: pr.item, suggested: pr.roomIndex })),
      ...unplaced.map((it) => ({ item: it, suggested: "" })),
    ].sort((a, b) => a.item.start - b.item.start);

    const rowsHtml = rows.map((r) => autoFillRow(r.item, r.suggested)).join("");

    modalTitleEl.textContent = "Relleno automático de salones";
    modalBodyEl.innerHTML = `
      <div class="mcal-autofill">
        <p class="mcal-autofill__intro">${escapeHTML(day.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}: ${proposals.length} de ${totalCandidates} clase(s) sin salón tienen sugerencia${unplaced.length ? `, ${unplaced.length} sin ubicar` : ""}. Revisa y cambia el salón donde quieras antes de aplicar. Las clases que ya tienen salón no se tocan.</p>
        <div class="mcal-autofill__list">${rowsHtml || "<p>No hay clases sin salón para asignar.</p>"}</div>
        <div class="mcal-autofill__actions">
          <button type="button" data-autofill-cancel>Cancelar</button>
          <button type="button" data-autofill-apply${rows.length ? "" : " disabled"}>Aplicar</button>
        </div>
        <p class="mcal-autofill__status" data-autofill-status aria-live="polite"></p>
      </div>`;
    modalEl.hidden = false;
    modalBodyEl.querySelector("[data-autofill-cancel]")?.addEventListener("click", () => { modalEl.hidden = true; });
    modalBodyEl.querySelector("[data-autofill-apply]")?.addEventListener("click", (ev) => applyAutoFill(ev.currentTarget));
  }

  async function applyAutoFill(button) {
    if (!isAdmin) return;
    const statusEl = modalBodyEl.querySelector("[data-autofill-status]");

    /* Lee lo que quedó seleccionado en cada fila (incluye cambios manuales). */
    const chosen = [...modalBodyEl.querySelectorAll("[data-autofill-select]")]
      .map((sel) => ({ groupKey: sel.dataset.groupKey, roomValue: sel.value }))
      .filter((c) => c.roomValue !== "" && c.groupKey);

    if (!chosen.length) {
      if (statusEl) statusEl.textContent = "Selecciona el salón de al menos una clase.";
      return;
    }

    /* Ocupación de salones ya asignados en el día (para avisar cruces). */
    const events = buildRoomsEvents();
    const day = getRoomsSelectedDay(events);
    const dayEvents = events.filter((e) => sameLocalDate(new Date(e.start), day));
    const chosenKeys = new Set(chosen.map((c) => c.groupKey));
    const occupancy = new Map();
    const addOcc = (ri, s, e) => {
      if (!occupancy.has(ri)) occupancy.set(ri, []);
      occupancy.get(ri).push({ start: s, end: e });
    };
    dayEvents.forEach((e) => {
      const asg = e.extendedProps?.roomAssignment;
      const ri = Number(asg?.roomIndex);
      const gk = e.extendedProps?.groupKey;
      if (asg && Number.isInteger(ri) && !chosenKeys.has(gk)) {
        addOcc(ri, new Date(e.start), new Date(e.end));
      }
    });

    const overlaps = (list, s, en) => (list || []).some((o) => o.start < en && s < o.end);
    const toApply = [];
    const conflicts = [];
    for (const c of chosen) {
      const bookings = getBookingsForGroup(c.groupKey);
      const base = bookings[0];
      if (!base) continue;
      const start = getBookingStart(base);
      const end = getBookingEnd(base, start);
      if (!start || !end) continue;
      const roomIndex = Number(c.roomValue);
      if (overlaps(occupancy.get(roomIndex), start, end)) {
        conflicts.push(`${base.serviceName || "Clase"} (${formatTime(start)}) en ${ROOMS[roomIndex]}`);
        continue;
      }
      addOcc(roomIndex, start, end);
      toApply.push({ groupKey: c.groupKey, roomIndex, bookings, start, end });
    }

    if (!toApply.length) {
      if (statusEl) statusEl.textContent = `Todas las selecciones tienen cruce de horario. Cambia de salón.`;
      return;
    }

    button.disabled = true;
    if (statusEl) statusEl.textContent = "Guardando...";

    try {
      let batch = writeBatch(db);
      let ops = 0;
      const applied = [];

      for (const a of toApply) {
        const { groupKey, roomIndex, bookings, start, end } = a;
        const payload = {
          groupKey,
          bookingIds: bookings.map((b) => b.bookingId || b._docId).filter(Boolean),
          serviceName: bookings[0].serviceName || "",
          staffName: bookings[0].staffName || "",
          staffEmail: bookings[0].staffEmail || "",
          roomIndex,
          roomName: ROOMS[roomIndex],
          startDate: Timestamp.fromDate(start),
          endDate: Timestamp.fromDate(end),
          source: "auto-fill",
          updatedAt: serverTimestamp(),
          updatedBy: email,
        };
        batch.set(doc(db, ROOM_ASSIGNMENTS_COLLECTION, roomAssignmentDocId(groupKey)), payload, { merge: true });
        ops += 1;
        bookings.forEach((b) => {
          batch.set(doc(db, COLLECTION_NAME, b._docId || b.bookingId), {
            roomIndex,
            roomName: ROOMS[roomIndex],
            roomAssignmentGroupKey: groupKey,
            roomAssignedAt: serverTimestamp(),
            roomAssignedBy: email,
          }, { merge: true });
          ops += 1;
        });
        applied.push({ groupKey, payload, bookings, roomIndex });

        /* Firestore limita cada batch a 500 operaciones. */
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();

      applied.forEach(({ groupKey, payload, bookings, roomIndex }) => {
        state.roomAssignments.set(groupKey, { ...payload, id: roomAssignmentDocId(groupKey) });
        bookings.forEach((b) => {
          b.roomIndex = roomIndex;
          b.roomName = ROOMS[roomIndex];
          b.roomAssignmentGroupKey = groupKey;
        });
      });

      modalEl.hidden = true;
      const suffix = conflicts.length ? ` (${conflicts.length} con cruce no aplicada[s])` : "";
      setRoomsNotice(`Relleno automático: ${applied.length} clase(s) asignada(s)${suffix}.`);
      renderEvents();
    } catch (error) {
      console.error("[ReservasCalendar] Error en relleno automático:", error);
      if (statusEl) statusEl.textContent = humanFirestorePermissionError(error);
      button.disabled = false;
    }
  }

  /* ---------------- Aviso de novedades a docentes ---------------- */

  function bookingChangedAt(b) {
    const stamps = [b.cancellationReceivedAt, b.updateReceivedAt, b.rescheduleReceivedAt, b.updatedAt, b.createdAt]
      .map(toDateSafe)
      .filter(Boolean);
    if (!stamps.length) return null;
    return new Date(Math.max(...stamps.map((d) => d.getTime())));
  }

  function renderUpdatesBanner({ cancelled, rescheduled, created }) {
    const section = (title, items, cls) => (items.length ? `
      <div class="mcal-updates__group mcal-updates__group--${cls}">
        <strong>${title} (${items.length})</strong>
        <ul>${items.slice(0, 8).map((i) => `<li>${escapeHTML(i.serviceName || "Clase")} — ${escapeHTML(formatDateTime(i.start))}</li>`).join("")}${items.length > 8 ? `<li>y ${items.length - 8} más…</li>` : ""}</ul>
      </div>` : "");
    return `
      <div class="mcal-updates__inner" role="status">
        <div class="mcal-updates__head">
          <span class="mcal-updates__badge">Novedades desde tu última visita</span>
          <button type="button" class="mcal-updates__dismiss" data-updates-dismiss aria-label="Cerrar novedades">×</button>
        </div>
        <div class="mcal-updates__groups">
          ${section("Canceladas", cancelled, "cancelled")}
          ${section("Reprogramadas", rescheduled, "rescheduled")}
          ${section("Nuevas clases", created, "created")}
        </div>
      </div>`;
  }

  async function showChangesBanner() {
    const el = container.querySelector("#mcal-updates");
    if (!el || !email) return;

    try {
      const seenRef = doc(db, "calendarLastSeen", email);
      const seenSnap = await getDoc(seenRef);
      const lastSeen = seenSnap.exists() ? toDateSafe(seenSnap.data().lastSeenAt) : null;

      /* Primera visita: no hay contra qué comparar. Solo registramos el sello. */
      if (!lastSeen) {
        await setDoc(seenRef, { email, lastSeenAt: serverTimestamp() }, { merge: true });
        return;
      }

      const today = startOfLocalDay(new Date());
      const horizon = addDays(today, 45);
      const snap = await getDocs(query(
        collection(db, COLLECTION_NAME),
        where("staffEmail", "==", email),
        where("startDate", ">=", Timestamp.fromDate(today)),
        where("startDate", "<", Timestamp.fromDate(horizon)),
        orderBy("startDate", "asc")
      ));

      const cancelled = [];
      const rescheduled = [];
      const created = [];
      const seenKeys = new Set();
      snap.forEach((docSnap) => {
        const b = { ...docSnap.data(), _docId: docSnap.id };
        const changed = bookingChangedAt(b);
        if (!changed || changed <= lastSeen) return;
        const status = normalizeStatus(b.status);
        const key = `${getGroupKey(b) || b.bookingId || b._docId}|${status}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const entry = { serviceName: b.serviceName, start: getBookingStart(b) };
        if (status === "cancelled") {
          cancelled.push(entry);
        } else if (status === "rescheduled" || status === "updated") {
          rescheduled.push(entry);
        } else if (toDateSafe(b.createdAt) && toDateSafe(b.createdAt) > lastSeen) {
          created.push(entry);
        }
      });

      /* Marcamos como visto (según lo acordado: se marca al abrir). */
      await setDoc(seenRef, { email, lastSeenAt: serverTimestamp() }, { merge: true });

      if (!(cancelled.length + rescheduled.length + created.length)) return;

      el.innerHTML = renderUpdatesBanner({ cancelled, rescheduled, created });
      el.hidden = false;
      el.querySelector("[data-updates-dismiss]")?.addEventListener("click", () => { el.hidden = true; });
    } catch (error) {
      console.warn("[ReservasCalendar] No se pudo cargar novedades:", error);
    }
  }

  function studentName(student, fallback = "Estudiante") {
    return student?.displayName || student?.nombre || student?.name ||
      student?.studentName || fallback;
  }

  function renderStudentProfile(student, email) {
    modalTitleEl.textContent = "Perfil del estudiante";
    if (!student) {
      modalBodyEl.innerHTML = `<p class="mcal-student-empty">No encontramos un perfil vinculado a ${escapeHTML(email)}.</p>`;
      return;
    }

    const fields = [
      ["Nombre", studentName(student)],
      ["Programa / área", student.processLabel || student.programa || student.area || student.instrumento],
      ["Nivel", student.nivel || student.level],
      ["Estado", student.estado || student.status || (student.active === false ? "Inactivo" : "Activo")],
    ].filter(([, value]) => value);

    modalBodyEl.innerHTML = `
      <dl class="mcal-modal__grid">
        ${fields.map(([label, value]) => `
          <div class="mcal-modal__row">
            <dt>${escapeHTML(label)}</dt>
            <dd>${escapeHTML(value)}</dd>
          </div>`).join("")}
      </dl>`;
  }

  function renderStudentJournal(student, entries = [], email = "") {
    modalTitleEl.textContent = `Bitácoras de ${studentName(student)}`;
    if (!student) {
      modalBodyEl.innerHTML = `<p class="mcal-student-empty">No encontramos un perfil vinculado a ${escapeHTML(email)}.</p>`;
      return;
    }
    if (!entries.length) {
      modalBodyEl.innerHTML = `<p class="mcal-student-empty">Este estudiante aún no tiene bitácoras registradas.</p>`;
      return;
    }

    modalBodyEl.innerHTML = `
      <div class="mcal-journal">
        <p class="mcal-journal__count">${entries.length} bitácoras registradas</p>
        ${entries.map((entry) => {
          const date = toDateSafe(entry.fechaClase || entry.date || entry.createdAt);
          const title = entry.title || entry.titulo || entry.topic || entry.tema || "Bitácora de clase";
          const content = entry.content || entry.contenido || entry.description ||
            entry.descripcion || entry.notes || entry.observaciones || "";
          const teacher = entry.author?.name || entry.authorName || entry.docente ||
            entry.teacher || entry.teacherName || "";
          const process = typeof entry.process === "string"
            ? entry.process
            : entry.process?.label || entry.process?.name || entry.proceso || "";
          return `
            <article class="mcal-journal__entry">
              <time>${escapeHTML(date ? date.toLocaleDateString("es-CO", {
                day: "numeric", month: "long", year: "numeric",
              }) : "Sin fecha")}</time>
              <h4>${escapeHTML(title)}</h4>
              <p class="mcal-journal__meta">${escapeHTML([teacher, process].filter(Boolean).join(" · "))}</p>
              <p>${escapeHTML(content)}</p>
            </article>`;
        }).join("")}
      </div>`;
  }
  modalEl.addEventListener("click", onModalClick);

  if (isAdmin) setDisplayMode("rooms");

  /* ------------------------ Destroy ------------------------- */

  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }
    document.removeEventListener("keydown", onEscClose);
    modalEl.removeEventListener("click", onModalClick);
    if (state.calendar) {
      state.calendar.destroy();
      state.calendar = null;
    }
    container.innerHTML = "";
    if (typeof onDisplayModeChange === "function") onDisplayModeChange("calendar");
  }

  function goToDate(date) {
    const target = toDateSafe(date);
    if (!target || !state.calendar) return;
    state.calendar.gotoDate(target);
  }

  return { destroy, isAdmin, goToDate };
}
