import { openAvailability } from "./availability.js?v=2026-10-21.1";
/* Musicala · Docentes Hub
   - Login con Google (Firebase Auth)
   - Hub exclusivo para Docentes (lista blanca por correo)
   - Links generales + links personalizados por usuario
   - Carnet abre modal (imagen en /assets/*.png)
   - Drawer lateral: perfil + accesos rápidos + logout
   - PWA con instalación + SW update banner
   - Horario docente fijo desde Firestore
   - Bitácora de tareas académicas con link individual por docente
   - Bitácoras de clase
*/

const BUILD = "2026-10-21.1";

/* Safari iOS puede superponer su barra inferior sobre los elementos fixed.
   VisualViewport entrega el área realmente visible; conservamos la diferencia
   como una variable CSS para elevar la navegación inferior mientras la barra
   esté presente. En una PWA o en navegadores sin esa superposición vale 0. */
function syncBrowserUiOffset() {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const coveredBottom = Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
  );
  document.documentElement.style.setProperty("--browser-ui-offset", `${coveredBottom}px`);
}

function setupBrowserUiOffset() {
  syncBrowserUiOffset();
  window.addEventListener("resize", syncBrowserUiOffset, { passive: true });
  window.visualViewport?.addEventListener("resize", syncBrowserUiOffset, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncBrowserUiOffset, { passive: true });
}
const OFFICIAL_CLASS_LOG_URL = "https://bitacoras-de-clase.web.app/#search";
const WIX_BOOKINGS_URL = "https://wixbookingsmusicala.web.app/";

// Versión única de las condiciones para Docentes de apoyo. El texto vive una
// sola vez en este archivo; cada aceptación conserva esta versión y un resumen
// verificable del contenido, sin reutilizar contratos particulares.
const SUPPORT_CONTRACT_VERSION = "1.0";
const SUPPORT_PROFILE_FIELDS = ["fullName", "documentType", "documentNumber", "documentIssueCity", "phone", "address", "residenceCity", "artisticArea"];

const ADMIN_EMAILS = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
  "musicalaasesor@gmail.com",
  "adminmusicala@gmail.com"
];

/* ============================================================================
   1) FIREBASE CONFIG
============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyC06dLl2Lig3-kD4OVmh4C9LpFW9AeTyOc",
  authDomain: "musicala-docentes-hub.firebaseapp.com",
  projectId: "musicala-docentes-hub",
  storageBucket: "musicala-docentes-hub.firebasestorage.app",
  messagingSenderId: "936379833270",
  appId: "1:936379833270:web:512519cf318c919e3abf17"
};

/* ============================================================================
   1b) FIREBASE BIBLIOTECA DE RECURSOS (proyecto aparte, solo lectura)
   La biblioteca vive en otro proyecto Firebase con lectura pública. El HUB la
   lee con una segunda app nombrada; no se escribe nada desde aquí.
============================================================================ */
const BIBLIOTECA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8p1Ges94PMBPE-wuFVjeE5uGzeUQYBS0",
  authDomain: "biblioteca-guitarra-fa182.firebaseapp.com",
  projectId: "biblioteca-guitarra-fa182",
  storageBucket: "biblioteca-guitarra-fa182.firebasestorage.app",
  messagingSenderId: "803045423554",
  appId: "1:803045423554:web:9bd5bda0d45f9e33f07e5b"
};

// Áreas macro que se asignan a cada docente desde el panel admin.
const STUDENTS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDQcHQEzGE1DDpD1b_foUTmVo3D9LK_0N0",
  authDomain: "bitacoras-de-clase.firebaseapp.com",
  projectId: "bitacoras-de-clase",
  storageBucket: "bitacoras-de-clase.appspot.com",
  messagingSenderId: "1047385643159",
  appId: "1:1047385643159:web:074d75890a648f6ac5f1d2"
};

const BIBLIOTECA_MACRO_AREAS = ["Música", "Danzas", "Artes plásticas", "Teatro"];

/* ============================================================================
   2) CONFIG DOCENTES HUB
============================================================================ */
const HUB = {
  name: "Docentes · Musicala",

  GENERAL_LINKS: {
    salones: "https://musicala.github.io/asignaciondesalones/",
    observacion: "https://docs.google.com/forms/d/1z8TEQACP6L8d0vTWEpSl2RQJ198PwQwzH4-UKqq9EQA/viewform?edit_requested=true",
    induccion: "https://musicalaescuela.github.io/inducciondocentesmusicala/",
    jornada: "__INTERNAL_TEACHER_SHIFT__",
    muestras: "https://musicalaescuela.github.io/muestrasdeproceso/#musica",
    guiones: "https://musicalaescuela.github.io/plantillaparaguiones/",
    protocolosMusica: "https://musicalaescuela.github.io/protocolosmusica/",
    vacaciones: "https://musicalaescuela.github.io/vacacionesartisticas/",
    vacacionales: "https://vacacionales-fb909.firebaseapp.com",
    explicacionArtes: "https://musicala.github.io/explicacionartes/",
    edades: "https://musicala.github.io/musiedades/",
    reglamento: "https://drive.google.com/file/d/1Oda0c_FnHrsgME2GE8LCb7z5huH-YbBk/view",
    musicalaFest: "https://musicalaescuela.github.io/programamusicalafest2025/",
    bitacoraClasesNueva: OFFICIAL_CLASS_LOG_URL,
    musigym: "https://musicalaescuela.github.io/musigymtraininghub/",
    ensambles: "https://musicalaescuela.github.io/ensambles/",

    calendario: "https://musicala.github.io/calendariomusicala/",

    // Por defecto vacíos para que aparezcan como "Pendiente"
    bitacoraAcademica: "",
    documentosContratacion: ""
  },

  USERS: {
    "alekcaballeromusic@gmail.com": {
      label: "Alek Caballero",
      carnet: "./assets/alekcaballero.png",
      links: {
        bitacoraAcademica: ""
      }
    },

    "catalina.medina.leal@gmail.com": {
      label: "Catalina Medina",
      carnet: "./assets/catalinamedina.png",
      links: {
        bitacoraAcademica: ""
      }
    },

    "emilybg0102@gmail.com": {
      label: "Emily Bejarano",
      carnet: "./assets/emilybejarano.png",
      links: {
        bitacoraAcademica: "https://musicala.github.io/bitacoratareasemilybejarano/"
      }
    },

    "annitolad@gmail.com": {
      label: "Angie Nitola",
      carnet: "./assets/angienitola.png",
      links: {
        bitacoraAcademica: "https://musicala.github.io/bitacoratareasangienitola/"
      }
    },

    "lorenaduarte.404@gmail.com": {
      label: "Laura Sánchez",
      carnet: "./assets/laurasanchez.png",
      links: {
        bitacoraAcademica: "https://musicala.github.io/bitacoradetareaslaurasanchez/"
      }
    },

    "malego2709@gmail.com": {
      label: "María Alejandra Gómez",
      carnet: "",
      links: {}
    },

    "tiritiri.riri@gmail.com": {
      label: "Isabel Gómez Gómez",
      carnet: "",
      links: {}
    },

    "darasaxcifuentes@gmail.com": {
      label: "Dara Natalia Cifuentes Rojas",
      carnet: "",
      links: {}
    }
  },

  BUTTONS: [
    { id: "disponibilidad", icon: "🗓️", title: "Mi disponibilidad", subtitle: "Universidad, días libres y excepciones", section: "Gestión docente" },
    // "Mi trabajo hoy": 5 accesos fijos, en este orden.
    { id: "calendario", icon: "🗓️", title: "Calendario Académico", subtitle: "General", section: "Mi trabajo hoy", showWhenMissing: true },
    {
      id: "bitacoraClasesNueva",
      icon: "✨",
      title: "Bitácoras de estudiantes",
      subtitle: "Seguimiento de clase",
      section: "Mi trabajo hoy"
    },
    { id: "bibliotecaRecursos", icon: "📚", title: "Biblioteca de Recursos", subtitle: "Materiales por área", section: "Mi trabajo hoy" },
    { id: "studentMessages", icon: "💬", title: "Mensajes de estudiantes", subtitle: "Conversaciones privadas", section: "Mi trabajo hoy" },
    {
      // Módulo interno unificado: tareas académicas + bolsa de horas.
      id: "bitacoraAcademica",
      icon: "✅",
      title: "Bitácora de Tareas Académicas",
      subtitle: "Tareas y bolsa de horas",
      section: "Mi trabajo hoy"
    },

    { id: "carnet", icon: "🪪", title: "Carnet docente", subtitle: "Personal", section: "Gestión docente" },
    { id: "supportContract", icon: "🤝", title: "Mi vinculación como Docente de apoyo", subtitle: "Datos, condiciones y aceptación", section: "Gestión docente", supportOnly: true },
    { id: "jornada", icon: "⏱️", title: "Registro de jornada", subtitle: "Diario", section: "Gestión docente" },
    { id: "salones", icon: "🏫", title: "Asignación de salones", subtitle: "Sede", section: "Gestión docente" },
    { id: "horarioAnual", icon: "📅", title: "Horario", subtitle: "Tu semana fija", section: "Gestión docente" },
    {
      id: "observacion",
      icon: "👀",
      title: "Formulario observación docente",
      subtitle: "Registro",
      section: "Gestión docente"
    },
    { id: "induccion", icon: "🎓", title: "Inducción Docentes Musicala", subtitle: "Onboarding", section: "Recursos" },
    { id: "protocolosMusica", icon: "🎵", title: "Protocolos clases de música", subtitle: "Guía", section: "Recursos" },
    { id: "muestras", icon: "🎭", title: "Info Muestras de proceso", subtitle: "Planeación", section: "Recursos" },
    { id: "guiones", icon: "🎬", title: "Plantilla guiones de video", subtitle: "Contenido", section: "Recursos" },
    { id: "explicacionArtes", icon: "🧩", title: "Explicación de las artes", subtitle: "Oferta", section: "Recursos" },
    { id: "edades", icon: "📏", title: "Rangos de edades", subtitle: "Guía rápida", section: "Recursos" },
    { id: "musigym", icon: "🏋️", title: "MusiGym Training Hub", subtitle: "Entrenamiento", section: "Recursos" },
    { id: "ensambles", icon: "🎶", title: "Ensambles", subtitle: "Agrupaciones", section: "Recursos" },

    { id: "reglamento", icon: "📜", title: "Reglamento interno de trabajo", subtitle: "Documento", section: "Institucional" },
    { id: "documentosContratacion", icon: "📁", title: "Documentos de contratación", subtitle: "Carpeta", section: "Institucional", showWhenMissing: true },
    { id: "vacaciones", icon: "🌞", title: "Info Vacaciones artísticas", subtitle: "General", section: "Institucional" },
    { id: "vacacionales", icon: "🌴", title: "Vacacionales", subtitle: "Cursos", section: "Institucional" },
    { id: "musicalaFest", icon: "🎸", title: "Musicala Fest 2025", subtitle: "Programa", section: "Institucional" },

    { id: "adminPanel", icon: "🛠️", title: "Panel admin", subtitle: "Solo administradores", section: "Administración", adminOnly: true }
  ]
};

/* ============================================================================
   3) FIREBASE SDK (CDN MODULAR)
============================================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  Timestamp,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  deleteDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ============================================================================
   4) HELPERS BASE
============================================================================ */
const $ = (selector, root = document) => root?.querySelector?.(selector) || null;
const $$ = (selector, root = document) => Array.from(root?.querySelectorAll?.(selector) || []);

const APP_STATE = {
  activeLinks: {},
  activeProfile: null,
  activeUser: null,
  hubUserDoc: null,    // doc de hubUsers del usuario activo (areas, especialidades…)
  db: null,
  bibliotecaDb: null,  // Firestore del proyecto biblioteca (solo lectura)
  studentsDb: null,
  studentsAuth: null,
  studentsAuthWired: false,
  unreadStudentMessages: 0,
  unreadMessagesUnsubscribe: null,
  bibliotecaCache: { recursos: null, areasConfig: null },
  teacherSchedule: {
    loading: false,
    schedule: null,
    overrides: {}
  },
  teacherShiftStatus: {
    open: false,
    record: null
  }
};

function updateStudentMessagesBadge(count = 0) {
  APP_STATE.unreadStudentMessages = Math.max(0, Number(count) || 0);
  const tile = document.querySelector('button[data-id="studentMessages"]');
  if (!tile) return;
  const icon = $(".ico", tile);
  let badge = $(".messageTileBadge", tile);
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "messageTileBadge";
    badge.setAttribute("aria-hidden", "true");
    if (icon) {
      icon.classList.add("iconWithNotify");
      icon.appendChild(badge);
    } else {
      tile.appendChild(badge);
    }
  } else if (icon && badge.parentElement !== icon) {
    icon.classList.add("iconWithNotify");
    icon.appendChild(badge);
  }
  badge.textContent = APP_STATE.unreadStudentMessages > 99 ? "99+" : String(APP_STATE.unreadStudentMessages);
  badge.hidden = APP_STATE.unreadStudentMessages === 0;
  tile.setAttribute("aria-label", APP_STATE.unreadStudentMessages
    ? `Mensajes de estudiantes, ${APP_STATE.unreadStudentMessages} sin leer`
    : "Mensajes de estudiantes");
}

function messageSentAt(message = {}) {
  const value = message.createdAt || message.sentAt || message.createdAtClient || message.updatedAt;
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "Enviando…";
  return date.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

const CHAT_QUICK_EMOJIS = ["👍", "👏", "😊", "🎉", "💪", "✨", "🎵", "❤️", "🙌", "👋", "🤔", "✅", "📌", "🙏", "😄"];

function startStudentMessagesBadge() {
  APP_STATE.unreadMessagesUnsubscribe?.();
  APP_STATE.unreadMessagesUnsubscribe = null;
  ensureStudentsServices();
  if (emailKey(APP_STATE.studentsAuth.currentUser) !== emailKey(APP_STATE.activeUser)) {
    updateStudentMessagesBadge(0);
    return;
  }
  const base = collection(APP_STATE.studentsDb, "student_messages");
  const inboxQuery = isAdminUser(APP_STATE.activeUser)
    ? query(base, limit(100))
    : query(base, where("teacherEmail", "==", emailKey(APP_STATE.activeUser)), limit(100));
  APP_STATE.unreadMessagesUnsubscribe = onSnapshot(inboxQuery, (snap) => {
    updateStudentMessagesBadge(snap.docs.filter((item) => item.data()?.teacherUnread === true).length);
  }, (error) => {
    console.warn("No se pudo actualizar el contador de mensajes", error);
    updateStudentMessagesBadge(0);
  });
}

const TEACHER_SITE_QR_ARRIVAL = "ADM-LLEGADA";
const TEACHER_SITE_QR_EXIT = "ADM-SALIDA";
const TEACHER_SITE_QR_LUNCH = [
  "ADM-ALMUERZO-INICIO",
  "ADM-ALMUERZO-FIN"
];
const TEACHER_SHIFT_EMAIL_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzDNyxzjieDdAdX8UyzXVTdGFWPj4JEJ6Q3OtKHjMqCI0QlDyak3ZEW49LYDm6ANUVSKA/exec";
const TEACHER_SHIFT_NOTIFY_EXITS = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeQrValue(value) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function searchTokens(value) {
  const ignored = new Set(["de", "del", "la", "las", "el", "los", "y", "o", "para", "por", "con", "en", "un", "una"]);
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((token) => token.length > 1 && !ignored.has(token));
}

function bibliotecaSearchScore(recurso, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return 0;

  const enlaces = Array.isArray(recurso?.enlaces) ? recurso.enlaces : [];
  const fields = [
    { text: recurso?.titulo, weight: 12 },
    { text: recurso?.tema, weight: 8 },
    { text: recurso?.area, weight: 7 },
    { text: recurso?.tipo, weight: 4 },
    { text: Array.isArray(recurso?.etiquetas) ? recurso.etiquetas.join(" ") : "", weight: 5 },
    { text: recurso?.descripcion, weight: 2 },
    { text: enlaces.flatMap((l) => [l?.titulo, l?.nombre, l?.tipo]).join(" "), weight: 3 },
    { text: enlaces.map((l) => l?.url).join(" "), weight: 1 }
  ].map((field) => ({ ...field, normalized: normalizeText(field.text) }));

  let score = 0;
  let matchedTokens = 0;

  tokens.forEach((token) => {
    let tokenScore = 0;
    fields.forEach((field) => {
      if (!field.normalized.includes(token)) return;
      tokenScore += field.weight;
      if (field.normalized.split(/\s+/).includes(token)) tokenScore += field.weight;
    });
    if (tokenScore > 0) matchedTokens += 1;
    score += tokenScore;
  });

  if (matchedTokens < tokens.length) return 0;

  const titleTokens = searchTokens(recurso?.titulo);
  const titleMatches = tokens.filter((token) => titleTokens.some((titleToken) => titleToken.includes(token)));
  if (titleMatches.length) score += titleMatches.length * 20;
  if (titleMatches.length === tokens.length) score += 40;

  return score;
}

function bibliotecaMinimumSearchScore(query) {
  return searchTokens(query).length > 1 ? 30 : 1;
}

function emailKey(user) {
  return String(user?.email || "").toLowerCase().trim();
}

function prettyName(user, fallbackEmail = "") {
  const name = String(user?.displayName || "").trim();
  const email = String(user?.email || fallbackEmail || "").trim();
  return name || email || "Sesión activa";
}

function getButtonMeta(buttonId) {
  return HUB.BUTTONS.find((button) => button.id === buttonId) || null;
}

function getButtonTitle(buttonId) {
  return getButtonMeta(buttonId)?.title || buttonId || "este acceso";
}

function hasUserRestrictions() {
  return !!(HUB.USERS && Object.keys(HUB.USERS).length > 0);
}

function buildLinksForUser(email) {
  const base = { ...(HUB.GENERAL_LINKS || {}) };
  const profile = HUB.USERS?.[email] || null;
  const overrides = profile?.links || {};
  return { ...base, ...overrides };
}

/* ----------------------------------------------------------------------------
   Botones personalizados (creados desde el panel admin, guardados en Firestore
   en la colección `hubButtons`). Se inyectan en HUB.BUTTONS y su URL global en
   HUB.GENERAL_LINKS, de modo que pasan por el mismo flujo de visibilidad y
   asignación por docente que los botones nativos.
---------------------------------------------------------------------------- */
function slugifyButtonId(text) {
  const base = normalizeText(text)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `custom_${base || Date.now().toString(36)}`;
}

async function fetchCustomButtons() {
  if (!APP_STATE.db) return [];
  try {
    const snap = await getDocs(collection(APP_STATE.db, "hubButtons"));
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    list.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
      || String(a.title || "").localeCompare(String(b.title || ""), "es"));
    return list;
  } catch (error) {
    console.warn("No se pudieron cargar los botones personalizados", error);
    return [];
  }
}

// Reemplaza los botones personalizados previos en HUB.BUTTONS por la lista dada
// y registra sus URLs en HUB.GENERAL_LINKS. Idempotente.
function applyCustomButtons(list = []) {
  HUB.BUTTONS = (HUB.BUTTONS || []).filter((b) => !b.custom);
  // Limpia URLs de botones personalizados anteriores.
  for (const key of Object.keys(HUB.GENERAL_LINKS || {})) {
    if (key.startsWith("custom_")) delete HUB.GENERAL_LINKS[key];
  }
  const adminIndex = HUB.BUTTONS.findIndex((b) => b.id === "adminPanel");
  const insertAt = adminIndex >= 0 ? adminIndex : HUB.BUTTONS.length;
  const mapped = list.map((b) => ({
    id: b.id,
    icon: b.icon || "🔗",
    title: b.title || "Acceso",
    subtitle: b.subtitle || "",
    section: b.section || "Recursos",
    custom: true
  }));
  HUB.BUTTONS.splice(insertAt, 0, ...mapped);
  for (const b of list) {
    const isClassLog = normalizeText(`${b.title || ""} ${b.subtitle || ""}`).includes("bitacoras de clase");
    if (b.url || isClassLog) HUB.GENERAL_LINKS[b.id] = isClassLog ? OFFICIAL_CLASS_LOG_URL : String(b.url);
  }
}

// Carga y aplica los botones personalizados para cualquier usuario (no solo
// admin), de modo que se rendericen en el HUB del docente.
async function loadCustomButtons() {
  const list = await fetchCustomButtons();
  ADMIN_STATE.customButtons = list;
  applyCustomButtons(list);
  return list;
}

async function saveCustomButton(button) {
  const ref = doc(APP_STATE.db, "hubButtons", button.id);
  const payload = {
    icon: button.icon || "🔗",
    title: button.title || "Acceso",
    subtitle: button.subtitle || "",
    section: button.section || "Recursos",
    url: button.url || "",
    order: Number.isFinite(Number(button.order)) ? Number(button.order) : 0,
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, payload, { merge: true });
  return { id: button.id, ...payload };
}

async function deleteCustomButton(id) {
  await deleteDoc(doc(APP_STATE.db, "hubButtons", id));
}

function getAssignableButtons() {
  return HUB.BUTTONS.filter((button) => !button.adminOnly);
}

function getVisibleButtonsForUserDoc(docData = null) {
  return Array.isArray(docData?.visibleButtons)
    ? docData.visibleButtons.map((id) => String(id || "").trim()).filter(Boolean)
    : null;
}

function assertConfig(config) {
  const isInvalid =
    !config ||
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.appId;

  if (isInvalid) {
    console.warn("Firebase config incompleto. Revisa firebaseConfig en app.js");
    return false;
  }

  return true;
}

/* ============================================================================
   5) TOAST
============================================================================ */
let toastTimer = null;

function pickToastEl() {
  const toastApp = $("#toast-app");
  const toastFallback = $("#toast");
  if (toastApp && !toastApp.hidden) return toastApp;
  return toastFallback || toastApp || null;
}

function toast(message, options = {}) {
  const el = pickToastEl();
  if (!el) return;

  const {
    actionText = "",
    onAction = null,
    sticky = false,
    ms = 2600
  } = options;

  el.classList.remove("show");
  el.hidden = false;
  el.innerHTML = "";

  const msgSpan = document.createElement("span");
  msgSpan.className = "toastMsg";
  msgSpan.textContent = String(message ?? "");
  el.appendChild(msgSpan);

  if (actionText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toastBtn";
    button.textContent = actionText;
    button.addEventListener("click", () => {
      try {
        onAction?.();
      } finally {
        el.classList.remove("show");
      }
    });
    el.appendChild(button);
  }

  requestAnimationFrame(() => el.classList.add("show"));

  clearTimeout(toastTimer);
  if (!sticky) {
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      if (el.id === "toast-app") {
        el.hidden = true;
      }
    }, Math.max(1200, Number(ms) || 2600));
  }
}

function setButtonBusy(button, busy, busyLabel = "Procesando...") {
  if (!button) return;
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || "";
  }

  button.disabled = !!busy;
  button.setAttribute("aria-busy", busy ? "true" : "false");
  button.textContent = busy ? busyLabel : button.dataset.originalText;
}

/* ============================================================================
   6) VISTAS
============================================================================ */
function show(which) {
  const loginView = $("#view-login");
  const appView = $("#view-app");
  if (!loginView || !appView) return;

  if (which === "login") {
    loginView.hidden = false;
    appView.hidden = true;

    const toastApp = $("#toast-app");
    if (toastApp) toastApp.hidden = true;
  } else {
    loginView.hidden = true;
    appView.hidden = false;
  }
}

/* ============================================================================
   7) URL SAFETY
============================================================================ */
function normalizeUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";

  if (/^\s*javascript:/i.test(url)) return "";
  if (/^\s*data:/i.test(url)) return "";
  if (/^(https?:)?\/\//i.test(url)) return url;

  return `https://${url}`;
}

function openExternal(rawUrl) {
  const safeUrl = normalizeUrl(rawUrl);
  if (!safeUrl) return false;

  // Forzar apertura en el navegador REAL del sistema (Chrome/Safari), no en el
  // WebView embebido de la PWA. Esto es imprescindible para enlaces que usan
  // login OAuth de Google/Firebase (p. ej. "Cursos Vacacionales 2026"): Google
  // bloquea el inicio de sesión dentro de WebViews (disallowed_useragent) y la
  // sesión no se conserva. Un <a target="_blank"> con clic sintético entrega la
  // URL al sistema operativo y rompe el bucle de login.
  try {
    const a = document.createElement("a");
    a.href = safeUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (_) {
    // Fallback por si el ancla falla en algún entorno restringido.
    window.open(safeUrl, "_blank", "noopener,noreferrer");
    return true;
  }
}

/* ============================================================================
   8) PWA
============================================================================ */
let deferredInstallPrompt = null;

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function isStandalone() {
  if (window.navigator.standalone) return true;
  return !!(
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function setInstallUI(visible) {
  const btn1 = $("#btn-install");
  const btn2 = $("#btn-install-2");
  if (btn1) btn1.hidden = !visible;
  if (btn2) btn2.hidden = !visible;
}

async function trySkipWaiting() {
  try {
    const registration = await navigator.serviceWorker.getRegistration("./");
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return true;
    }
  } catch (_) {}
  return false;
}

function wireUpdateBanner() {
  const wrap = $("#pwa-update");
  const btn = $("#btn-update");
  if (!wrap || !btn) return;

  btn.addEventListener("click", async () => {
    const ok = await trySkipWaiting();
    if (!ok) {
      toast("No hay actualización lista aún 🙃");
    }
  });

  const maybeShow = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration("./");
      if (registration?.waiting) {
        wrap.hidden = false;
      }
    } catch (_) {}
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event?.data?.type === "SW_ACTIVATED") {
        wrap.hidden = true;
      }
    });
    maybeShow();
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Aplica la actualización automáticamente. Si hay un SW "waiting",
  // le pedimos que tome el control de inmediato (sin que la docente toque nada).
  // Se deja el banner/toast solo como respaldo por si el auto-update no aplica.
  const applyUpdate = (registration) => {
    if (!registration?.waiting) return;
    try {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      console.warn("No se pudo activar update automáticamente", error);
      // Respaldo: mostramos el banner para que pueda forzar la actualización.
      const wrap = $("#pwa-update");
      if (wrap) wrap.hidden = false;
    }
  };

  try {
    const registration = await navigator.serviceWorker.register(`./sw.js?v=${BUILD}`, {
      scope: "./",
      updateViaCache: "none"
    });

    applyUpdate(registration);

    registration.addEventListener("updatefound", () => {
      const sw = registration.installing;
      if (!sw) return;

      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          applyUpdate(registration);
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (window.__reloadingForSW) return;
      window.__reloadingForSW = true;
      window.location.reload();
    });

    // Chequeos de actualización: al cargar, al volver a la app y cada 60s.
    const checkForUpdate = () => registration.update?.().catch(() => null);
    checkForUpdate();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
    setInterval(checkForUpdate, 60 * 1000);
  } catch (error) {
    console.warn("SW no se pudo registrar", error);
  }
}

function setupInstallPrompt() {
  if (isStandalone()) {
    setInstallUI(false);
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallUI(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    setInstallUI(false);
    toast("Instalada ✨");
  });

  const onInstallClick = async () => {
    if (isIOS() && !deferredInstallPrompt) {
      toast("En iPhone/iPad: Compartir → Agregar a pantalla de inicio");
      return;
    }

    if (!deferredInstallPrompt) {
      toast("Instalación no disponible todavía. Abre en Chrome o Safari.");
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;

    if (!choice || choice.outcome !== "accepted") {
      setInstallUI(false);
      setTimeout(() => setInstallUI(true), 8000);
    }
  };

  $("#btn-install")?.addEventListener("click", onInstallClick);
  $("#btn-install-2")?.addEventListener("click", onInstallClick);
}

/* ============================================================================
   9) DRAWER
============================================================================ */
let drawerBound = false;

function drawerEls() {
  return {
    btnMenu: $("#btn-menu"),
    overlay: $("#drawer-overlay"),
    drawer: $("#app-drawer"),
    btnClose: $("#btn-drawer-close"),
    userName: $("#drawer-user-name"),
    userEmail: $("#drawer-user-email"),
    buildTag: $("#drawer-build")
  };
}

function isDrawerOpen() {
  const { overlay, drawer } = drawerEls();
  if (!overlay || !drawer) return false;
  return !overlay.hidden && !drawer.hidden;
}

function openDrawer() {
  const { overlay, drawer, btnClose } = drawerEls();
  if (!overlay || !drawer) return;

  overlay.hidden = false;
  drawer.hidden = false;
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    (btnClose || drawer).focus?.();
  }, 0);
}

function closeDrawer() {
  const { overlay, drawer, btnMenu } = drawerEls();
  if (!overlay || !drawer) return;

  overlay.hidden = true;
  drawer.hidden = true;
  document.body.style.overflow = "";

  setTimeout(() => {
    btnMenu?.focus?.();
  }, 0);
}

function toggleDrawer() {
  if (isDrawerOpen()) closeDrawer();
  else openDrawer();
}

function setDrawerProfile(profile, user) {
  const { userName, userEmail, buildTag } = drawerEls();
  if (userName) userName.textContent = profile?.label || user?.displayName || "Docente";
  if (userEmail) userEmail.textContent = String(user?.email || "").trim() || "—";
  if (buildTag) buildTag.textContent = `BUILD ${BUILD}`;
}

function wireDrawerHandlers(auth) {
  if (drawerBound) return;
  drawerBound = true;

  const { btnMenu, overlay, drawer, btnClose } = drawerEls();
  if (!overlay || !drawer) return;

  btnMenu?.addEventListener("click", toggleDrawer);
  btnClose?.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isDrawerOpen()) {
      closeDrawer();
    }
  });

  drawer.addEventListener(
    "click",
    async (event) => {
      const button = event.target.closest("[data-drawer-action]");
      if (!button) return;

      const action = String(button.getAttribute("data-drawer-action") || "").trim();
      if (!action) return;

      closeDrawer();

      if (action === "logout") {
        await doLogout(auth);
        return;
      }

      if (action === "install") {
        const installBtn = $("#btn-install-2") || $("#btn-install");
        installBtn?.click?.();
        return;
      }

      if (/^open:/i.test(action)) {
        const id = action.split(":")[1] || "";
        if (!id) return;
        handleButtonAction(id);
        return;
      }

      if (action === "favorites") {
        openFavoritesModal();
        return;
      }

      if (action === "search") {
        focusHubSearch();
        return;
      }

      if (action === "switchHub") {
        openHubSwitcherModal();
        return;
      }

      if (action === "support") {
        openSupportModal();
        return;
      }

      const href = button.getAttribute("data-href");
      if (href && !openExternal(href)) {
        toast("Ese link está raro y lo bloqueé 😶‍🌫️");
      }
    },
    { passive: true }
  );
}

/* ============================================================================
   9b) ACCIONES DEL DRAWER: favoritos, buscar, cambiar hub, soporte
============================================================================ */
const FAV_USAGE_KEY = "hubFavUsage";

// Otros hubs de Musicala. Deja url vacía mientras el hub no exista todavía.
const OTHER_HUBS = [
  { id: "docentes", icon: "🎓", title: "Docentes", subtitle: "Este hub", current: true },
  { id: "admin", icon: "🛠️", title: "Admin", subtitle: "Panel de administración", adminPanel: true },
  { id: "practicantes", icon: "🌱", title: "Practicantes", subtitle: "Hub de practicantes", url: "https://musicala.github.io/practicanteshub/" }
];

function readFavUsage() {
  try {
    const raw = localStorage.getItem(FAV_USAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function trackButtonUsage(id) {
  if (!id || id === "adminPanel") return;
  try {
    const data = readFavUsage();
    data[id] = (Number(data[id]) || 0) + 1;
    localStorage.setItem(FAV_USAGE_KEY, JSON.stringify(data));
  } catch {
    /* almacenamiento lleno o bloqueado: no pasa nada */
  }
}

// Modal genérico y liviano para las acciones del menú lateral.
function openDrawerActionModal(title, bodyHtml) {
  $("#drawerActionModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "drawerActionModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", title);
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(11,16,32,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:grid;place-items:center;z-index:9999;padding:18px;";

  modal.innerHTML = `
    <div style="width:min(520px,100%);max-height:min(80vh,640px);display:flex;flex-direction:column;background:rgba(255,255,255,.96);border:1px solid rgba(11,16,32,.14);border-radius:22px;box-shadow:0 28px 80px rgba(11,16,32,.22);overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(11,16,32,.10);">
        <div style="font-weight:900;">${escapeHtml(title)}</div>
        <button type="button" data-modal-close class="btnGhost" style="height:36px;padding:0 12px;border-radius:12px;border:1px solid rgba(11,16,32,.14);background:rgba(255,255,255,.92);font-weight:850;cursor:pointer;">Cerrar</button>
      </div>
      <div style="padding:14px;overflow:auto;display:grid;gap:10px;">${bodyHtml}</div>
    </div>
  `;

  modal.firstElementChild?.classList.add("drawerActionCard");
  modal.querySelector("div > div:last-child")?.classList.add("drawerActionContent");

  const close = () => modal.remove();
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
    if (event.target.closest("[data-modal-close]")) close();
  });
  window.addEventListener(
    "keydown",
    function onKey(event) {
      if (event.key === "Escape") {
        close();
        window.removeEventListener("keydown", onKey);
      }
    }
  );

  document.body.appendChild(modal);
  return modal;
}

function drawerModalItem({ icon, title, subtitle, dataAttr, disabled = false }) {
  return `
    <button type="button" ${dataAttr} ${disabled ? "disabled" : ""}
      style="display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid rgba(11,16,32,.12);background:rgba(255,255,255,.9);cursor:${disabled ? "default" : "pointer"};opacity:${disabled ? ".55" : "1"};">
      <span style="font-size:22px;" aria-hidden="true">${escapeHtml(icon)}</span>
      <span style="display:grid;gap:2px;">
        <span style="font-weight:850;">${escapeHtml(title)}</span>
        <span style="font-size:12px;color:rgba(11,16,32,.62);">${escapeHtml(subtitle)}</span>
      </span>
    </button>
  `;
}

function openFavoritesModal() {
  const usage = readFavUsage();
  const items = Object.entries(usage)
    .map(([id, count]) => ({ id, count: Number(count) || 0, meta: getButtonMeta(id) }))
    .filter((item) => {
      if (!item.meta || !item.count) return false;
      return getResolvedButtonState(item.meta, APP_STATE.activeLinks).visible;
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (!items.length) {
    const modal = openDrawerActionModal(
      "Favoritos",
      `<p style="margin:0;color:rgba(11,16,32,.72);">Aún no tienes accesos frecuentes. A medida que uses los módulos del HUB, aquí aparecerán tus accesos más usados. ⭐</p>`
    );
    return modal;
  }

  const body = items
    .map((item) =>
      drawerModalItem({
        icon: item.meta.icon,
        title: item.meta.title,
        subtitle: `${item.meta.subtitle} · usado ${item.count} ${item.count === 1 ? "vez" : "veces"}`,
        dataAttr: `data-fav-id="${escapeHtml(item.id)}"`
      })
    )
    .join("");

  const modal = openDrawerActionModal("Favoritos", body);
  modal.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fav-id]");
    if (!btn) return;
    modal.remove();
    handleButtonAction(btn.getAttribute("data-fav-id"));
  });
}

function focusHubSearch() {
  const input = $("#hubSearchInput");
  if (!input) {
    toast("El buscador aparece en la pantalla principal del HUB 🔎");
    return;
  }
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => input.focus({ preventScroll: true }), 250);
}

function openHubSwitcherModal() {
  const body = OTHER_HUBS.map((hub) => {
    const available = hub.current || hub.adminPanel ? true : !!hub.url;
    const subtitle = hub.current
      ? "Estás aquí ahora"
      : available
        ? hub.subtitle
        : `${hub.subtitle} · próximamente`;
    return drawerModalItem({
      icon: hub.icon,
      title: hub.title,
      subtitle,
      dataAttr: `data-hub-id="${escapeHtml(hub.id)}"`,
      disabled: hub.current
    });
  }).join("");

  const modal = openDrawerActionModal("Cambiar Hub", body);
  modal.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-hub-id]");
    if (!btn) return;
    const hub = OTHER_HUBS.find((h) => h.id === btn.getAttribute("data-hub-id"));
    if (!hub || hub.current) return;

    if (hub.adminPanel) {
      modal.remove();
      if (isAdminUser()) openAdminPanel();
      else toast("El panel Admin es solo para administradores 🛠️");
      return;
    }

    if (!hub.url) {
      toast(`El hub de ${hub.title} aún no está disponible 🌱`);
      return;
    }

    modal.remove();
    if (!openExternal(hub.url)) toast("Ese link está raro y lo bloqueé 😶‍🌫️");
  });
}

function openSupportModal() {
  const body = `
    <p style="margin:0;color:rgba(11,16,32,.72);">Cuéntanos el error, idea o aspecto por mejorar. Se guarda directamente en el HUB para que coordinación pueda revisarlo y darte seguimiento aquí mismo.</p>
    <form id="supportReportForm" class="supportReportForm">
      <label>¿Qué quieres reportar?<select id="supportType" required><option value="error">Un error o algo que no funciona</option><option value="mejora">Una idea de mejora</option><option value="duda">Una duda o necesidad</option></select></label>
      <label>Cuéntanos qué pasó o qué propones<textarea id="supportDetail" required maxlength="3000" rows="5" placeholder="Incluye los pasos, el módulo y cualquier detalle que ayude a entenderlo."></textarea></label>
      <button class="btnGoogle" id="supportSubmit" type="submit">Enviar a coordinación</button>
    </form>
    <div id="supportMyReports" style="display:grid;gap:8px;"><p class="adminNote">Cargando tus reportes…</p></div>
  `;
  const modal = openDrawerActionModal("Soporte y mejoras", body);
  loadMySupportReports(modal);
  modal.addEventListener("click", async (event) => {
    const form = event.target.closest("#supportReportForm");
    if (!form || event.target.type !== "submit") return;
    event.preventDefault();
    const detail = $("#supportDetail", modal)?.value?.trim() || "";
    if (detail.length < 8) { toast("Cuéntanos un poco más para poder ayudarte."); return; }
    const submit = $("#supportSubmit", modal);
    submit.disabled = true; submit.textContent = "Guardando…";
    try {
      await addDoc(collection(APP_STATE.db, "supportReports"), { type: $("#supportType", modal)?.value || "mejora", detail, reporterEmail: emailKey(APP_STATE.activeUser), reporterName: APP_STATE.activeUser?.displayName || emailKey(APP_STATE.activeUser), status: "nuevo", createdAt: serverTimestamp(), createdAtClient: Date.now(), build: BUILD, userAgent: navigator.userAgent });
      form.reset(); toast("Reporte enviado. Te avisaremos aquí cuando haya avance ✅"); await loadMySupportReports(modal);
    } catch (error) { console.error("No se pudo guardar el reporte de soporte", error); toast("No pude guardar el reporte. Intenta de nuevo."); }
    finally { submit.disabled = false; submit.textContent = "Enviar a coordinación"; }
  });
}

function supportStatusLabel(status) { return ({ nuevo: "Recibido", en_revision: "En revisión", en_progreso: "En progreso", cumplido: "Mejora realizada", descartado: "No se implementará" })[status] || "Recibido"; }
function supportTypeLabel(type) { return ({ error: "Error", mejora: "Mejora", duda: "Duda o necesidad" })[type] || "Reporte"; }
function supportDate(value) { const ms = typeof value?.toMillis === "function" ? value.toMillis() : Number(value || 0); return ms ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(ms)) : "Hace un momento"; }
async function fetchSupportReportsFor(email = "") { const base = collection(APP_STATE.db, "supportReports"); const q = isAdminUser() && !email ? query(base, orderBy("createdAtClient", "desc"), limit(500)) : query(base, where("reporterEmail", "==", email), limit(100)); const snap = await getDocs(q); return snap.docs.map((item) => ({ id: item.id, ...(item.data() || {}) })).sort((a, b) => Number(b.createdAtClient || 0) - Number(a.createdAtClient || 0)); }
function renderSupportReport(report, admin = false) { const response = report.adminResponse ? `<p class="supportResponse"><strong>Actualización de coordinación:</strong> ${escapeHtml(report.adminResponse)}</p>` : ""; return `<article class="supportReport support-${escapeHtml(report.status || "nuevo")}"><div class="supportReportHead"><span class="supportTag">${escapeHtml(supportTypeLabel(report.type))}</span><span class="supportStatus">${escapeHtml(supportStatusLabel(report.status))}</span></div>${admin ? `<strong>${escapeHtml(report.reporterName || report.reporterEmail || "Docente")}</strong><small>${escapeHtml(report.reporterEmail || "")}</small>` : ""}<p>${escapeHtml(report.detail || "")}</p>${response}<small>${escapeHtml(supportDate(report.createdAt || report.createdAtClient))}</small></article>`; }
async function loadMySupportReports(modal) { const target = $("#supportMyReports", modal); if (!target || !APP_STATE.db) return; try { const reports = await fetchSupportReportsFor(emailKey(APP_STATE.activeUser)); target.innerHTML = `<strong style="margin-top:4px;">Tus reportes y avances</strong>${reports.length ? reports.map(renderSupportReport).join("") : '<p class="adminNote">Aún no has enviado reportes. Cuando coordinación implemente algo, el avance aparecerá aquí.</p>'}`; } catch (error) { target.innerHTML = `<p class="adminNote">No se pudieron cargar tus reportes: ${escapeHtml(error?.message || "sin permiso")}</p>`; } }

/* ============================================================================
   10) MODAL CARNET
============================================================================ */
let carnetModal = null;

function ensureCarnetModal() {
  if (carnetModal) return carnetModal;

  const modal = document.createElement("div");
  modal.id = "carnetModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Carnet docente");

  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(11,16,32,.55)";
  modal.style.backdropFilter = "blur(6px)";
  modal.style.webkitBackdropFilter = "blur(6px)";
  modal.style.display = "grid";
  modal.style.placeItems = "center";
  modal.style.zIndex = "9999";
  modal.style.padding = "18px";

  modal.innerHTML = `
    <div class="carnetCard" style="
      width:min(680px, 100%);
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(11,16,32,.14);
      border-radius: 22px;
      box-shadow: 0 28px 80px rgba(11,16,32,.22);
      overflow:hidden;
    ">
      <div class="carnetTop" style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding: 12px 14px;
        background: rgba(255,255,255,.86);
        border-bottom: 1px solid rgba(11,16,32,.10);
      ">
        <div class="carnetTitle" id="carnetTitle" style="font-weight:900;">Carnet docente</div>
        <button
          type="button"
          id="carnetClose"
          class="btnGhost"
          style="
            height:36px;
            padding:0 12px;
            border-radius:12px;
            border:1px solid rgba(11,16,32,.14);
            background: rgba(255,255,255,.92);
            font-weight:850;
            cursor:pointer;
          "
        >
          Cerrar
        </button>
      </div>

      <div class="carnetBody" style="padding: 14px;">
        <img
          id="carnetImg"
          alt="Carnet docente"
          style="
            width:100%;
            height:auto;
            border-radius: 16px;
            border: 1px solid rgba(11,16,32,.10);
            background: rgba(255,255,255,.6);
            display:block;
          "
        />
        <div
          id="carnetNote"
          style="
            margin-top: 10px;
            font-size: 12px;
            color: rgba(11,16,32,.68);
            text-align:center;
          "
        >
          Muestra este carnet para validar tu vinculación con Musicala.
        </div>
      </div>
    </div>
  `;

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  };

  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  modal.querySelector("#carnetClose")?.addEventListener("click", close);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      close();
    }
  });

  document.body.appendChild(modal);
  carnetModal = modal;
  return modal;
}

function openCarnet(profile) {
  const path = String(profile?.carnet || "").trim();
  if (!path) {
    toast("Este usuario no tiene carnet asignado en /assets 😶‍🌫️");
    return;
  }

  const modal = ensureCarnetModal();
  const image = $("#carnetImg", modal);
  const title = $("#carnetTitle", modal);

  if (title) {
    title.textContent = `Carnet · ${profile?.label || "Docente"}`;
  }

  if (image) {
    image.src = path;
    image.onerror = () => {
      toast("No pude cargar el carnet. Revisa el nombre del archivo en /assets 😵");
      image.onerror = null;
    };
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

/* ============================================================================
   11) REGISTRO DE JORNADA
============================================================================ */
let teacherShiftModal = null;
let teacherQrReader = null;
let teacherQrRunning = false;

function bogotaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

function getTeacherName() {
  return (
    APP_STATE.activeProfile?.label ||
    APP_STATE.activeUser?.displayName ||
    emailKey(APP_STATE.activeUser) ||
    "Docente"
  );
}

function getTeacherShiftSessionId(user = APP_STATE.activeUser) {
  const uid = String(user?.uid || "").trim();
  if (uid) return uid;
  return emailKey(user).replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
}

function getOpenTeacherShift(records = []) {
  const ordered = records
    .slice()
    .sort((a, b) => Number(a.createdAtClient || 0) - Number(b.createdAtClient || 0));
  let open = null;

  for (const record of ordered) {
    if (record.action === "fin_jornada") {
      open = null;
      continue;
    }

    if (record.action === "inicio_clase") {
      open = record;
    }
  }

  return open;
}

function getTeacherShiftActionLabel(action = "") {
  return action === "fin_jornada" ? "Salida" : "Ingreso";
}

function getTeacherShiftSourceLabel(source = "") {
  return {
    qr_sede: "QR",
    manual_hogar: "Manual hogar",
    manual_virtual: "Manual virtual",
    manual_fin: "Cierre manual",
    auto_cierre: "Cierre automático",
    auto_fin_sin_cierre: "Cierre automático",
    admin_manual: "Registro admin"
  }[source] || source || "-";
}

function getTeacherShiftModeLabel(modalidad = "") {
  return {
    sede: "Sede",
    hogar: "Hogar",
    virtual: "Virtual",
    jornada: "Jornada"
  }[modalidad] || modalidad || "-";
}


/* -------------------------------------------------------------------------
   Cierre automático de jornadas olvidadas
   - Si una jornada queda abierta y ya cambió el día en Bogotá, se crea una
     salida automática con la hora esperada de cierre del horario configurado.
   - Si no hay horario/override con hora final, se usa 23:59 para no dejar
     sesiones eternas flotando por la vida, que bastante tiene uno con la DIAN.
------------------------------------------------------------------------- */
let teacherShiftAutoCloseTimer = null;
let teacherShiftAutoCloseWired = false;

function compareDateStrings(a = "", b = "") {
  if (!a || !b) return 0;
  return String(a).localeCompare(String(b));
}

function bogotaLocalMs(dateStr, timeStr = "23:59") {
  const safeTime = /^\d{1,2}:\d{2}$/.test(String(timeStr || "")) ? String(timeStr) : "23:59";
  const ms = new Date(`${dateStr}T${safeTime}:00-05:00`).getTime();
  return Number.isFinite(ms) ? ms : Date.now();
}

function msUntilNextBogotaDayCheck() {
  const now = new Date();
  const { date } = bogotaParts(now);
  const [y, m, d] = date.split("-").map(Number);
  // 00:01 del día siguiente en Bogotá. La validación usa date < today.
  const target = new Date(Date.UTC(y, m - 1, d + 1, 5, 1, 0));
  return Math.max(60_000, target.getTime() - now.getTime());
}

async function getExpectedScheduleForAutoClose(email, date) {
  if (!APP_STATE.db || !email || !date) return null;

  try {
    const ovSnap = await getDoc(doc(APP_STATE.db, "teacherScheduleOverrides", overrideId(email, date)));
    if (ovSnap.exists()) {
      const ov = ovSnap.data() || {};
      return { start: ov.start || "", end: ov.end || "", source: "override" };
    }
  } catch (_) {}

  try {
    const schedSnap = await getDoc(doc(APP_STATE.db, "teacherSchedules", email));
    if (schedSnap.exists()) {
      const sched = schedSnap.data() || {};
      if (sched.type === "fijo" && sched.weekly) {
        const day = sched.weekly[weekdayKeyFromDate(date)] || {};
        return { start: day.start || "", end: day.end || "", source: "weekly" };
      }
    }
  } catch (_) {}

  return null;
}

async function getAutoCloseTimeForSession(session = {}) {
  const openRecord = session.openRecord || session.lastRecord || {};
  const email = String(session.email || openRecord.email || "").toLowerCase();
  const date = openRecord.date || session.date || "";
  const expected = await getExpectedScheduleForAutoClose(email, date);
  return expected?.end || "23:59";
}

function isStaleOpenSession(session = {}, todayDate = bogotaParts().date) {
  if (!session.open) return false;
  const openRecord = session.openRecord || session.lastRecord || {};
  const openDate = openRecord.date || session.date || "";
  return !!openDate && compareDateStrings(openDate, todayDate) < 0;
}

async function closeOpenSessionAutomatically(sessionId, session = {}) {
  if (!APP_STATE.db || !sessionId || !session.open) return false;

  const openRecord = session.openRecord || session.lastRecord || {};
  const closeDate = openRecord.date || session.date || bogotaParts().date;
  const closeTime = await getAutoCloseTimeForSession(session);
  const closedAtClient = bogotaLocalMs(closeDate, closeTime);
  const recordRef = doc(collection(APP_STATE.db, "teacherClassStartRecords"));
  const sessionRef = doc(APP_STATE.db, "teacherOpenShiftSessions", sessionId);

  const payload = {
    role: "docente",
    email: String(session.email || openRecord.email || "").toLowerCase(),
    name: session.name || openRecord.name || "Docente",
    uid: session.uid || openRecord.uid || sessionId,
    date: closeDate,
    time: closeTime,
    stamp: new Date(closedAtClient).toISOString(),
    createdAt: serverTimestamp(),
    createdAtClient: closedAtClient,
    action: "fin_jornada",
    modalidad: openRecord.modalidad || "jornada",
    source: "auto_cierre",
    raw: "AUTO_CIERRE_SIN_MARCA_MANUAL",
    autoClosed: true,
    missingManualClose: true,
    autoCloseReason: "sin_cierre_al_finalizar_dia",
    openRecordId: session.openRecordId || openRecord.id || "",
    openedAtClient: session.openedAtClient || openRecord.createdAtClient || null
  };

  if (!payload.email) return false;

  await runTransaction(APP_STATE.db, async (transaction) => {
    const fresh = await transaction.get(sessionRef);
    const freshSession = fresh.exists() ? fresh.data() || {} : {};
    if (!freshSession.open) return;

    transaction.set(recordRef, payload);
    transaction.set(sessionRef, {
      open: false,
      email: payload.email,
      uid: payload.uid,
      name: payload.name,
      closedAt: serverTimestamp(),
      closedAtClient,
      closeRecordId: recordRef.id,
      lastRecord: payload,
      autoClosed: true,
      missingManualClose: true
    }, { merge: true });
  });

  return true;
}

async function autoCloseStaleOpenShifts({ includeAll = false, silent = true } = {}) {
  if (!APP_STATE.db || !APP_STATE.activeUser) return 0;
  const today = bogotaParts().date;
  const sessions = [];

  try {
    if (includeAll && isAdminUser()) {
      const snap = await getDocs(query(
        collection(APP_STATE.db, "teacherOpenShiftSessions"),
        where("open", "==", true),
        limit(200)
      ));
      snap.forEach((d) => sessions.push({ id: d.id, ...(d.data() || {}) }));
    } else {
      const sessionId = getTeacherShiftSessionId(APP_STATE.activeUser);
      const snap = await getDoc(doc(APP_STATE.db, "teacherOpenShiftSessions", sessionId));
      if (snap.exists()) sessions.push({ id: snap.id, ...(snap.data() || {}) });
    }
  } catch (error) {
    console.warn("No se pudieron revisar jornadas abiertas antiguas", error);
    return 0;
  }

  let closed = 0;
  for (const session of sessions) {
    if (!isStaleOpenSession(session, today)) continue;
    try {
      const didClose = await closeOpenSessionAutomatically(session.id, session);
      if (didClose) closed += 1;
    } catch (error) {
      console.warn("No se pudo cerrar automáticamente una jornada", session?.email || session?.id, error);
    }
  }

  if (closed && !silent) {
    toast(`${closed} jornada${closed === 1 ? "" : "s"} antigua${closed === 1 ? "" : "s"} cerrada${closed === 1 ? "" : "s"} automáticamente.`);
  }

  return closed;
}

function scheduleTeacherShiftAutoCloseCheck() {
  clearTimeout(teacherShiftAutoCloseTimer);
  teacherShiftAutoCloseTimer = null;

  if (!APP_STATE.teacherShiftStatus.open) return;
  teacherShiftAutoCloseTimer = setTimeout(async () => {
    await autoCloseStaleOpenShifts({ includeAll: isAdminUser(), silent: false });
    await refreshTeacherJornadaStatus();
  }, msUntilNextBogotaDayCheck());
}

function wireTeacherShiftAutoCloseWatchers() {
  if (teacherShiftAutoCloseWired) return;
  teacherShiftAutoCloseWired = true;

  const run = async () => {
    if (!APP_STATE.activeUser || !APP_STATE.db) return;
    await flushPendingShifts();
    await autoCloseStaleOpenShifts({ includeAll: isAdminUser(), silent: true });
    await refreshTeacherJornadaStatus();
  };

  window.addEventListener("focus", run);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) run();
  });
  window.addEventListener("online", () => {
    if (!APP_STATE.activeUser || !APP_STATE.db) return;
    flushPendingShifts();
  });
}

const MUSIPROFE_SUGGESTIONS = [
  "¿Cómo registro mi jornada?",
  "¿Qué hago si olvidé cerrar?",
  "¿Dónde está mi bitácora?",
  "No me abre un enlace",
  "Permisos de cámara",
  "Buscar recursos para clase"
];

const MUSIPROFE_KNOWLEDGE = [
  {
    match: ["jornada", "ingreso", "entrada", "qr", "sede"],
    answer: "Para registrar jornada entra a Registro de jornada. Si estás en sede, usa el QR autorizado de ingreso o salida. La app no permite otro ingreso mientras tengas una jornada abierta."
  },
  {
    match: ["cerrar", "salida", "olvid", "abierta", "sesion", "sesión"],
    answer: "Si olvidaste cerrar, vuelve a Registro de jornada. MusiProfe te mostrará la sesión abierta y podrás tocar Sí, cerrar jornada antes de crear un nuevo ingreso."
  },
  {
    match: ["bitacora", "bitácora", "clase", "evidencia", "tarea"],
    answer: "La bitácora está en el botón Bitácoras de clase. Después de terminar tus clases, deja allí la evidencia y el seguimiento del proceso del estudiante."
  },
  {
    match: ["link", "enlace", "pendiente", "abre", "abrir"],
    answer: "Si un enlace aparece como Pendiente, todavía no hay un link asignado para tu perfil. Si un enlace no abre, prueba actualizar la app y reporta el botón exacto."
  },
  {
    match: ["camara", "cámara", "permiso", "qr"],
    answer: "Para leer QR revisa que el navegador tenga permiso de cámara, selecciona la cámara correcta y usa buena luz. En celular suele funcionar mejor la cámara trasera."
  },
  {
    match: ["recurso", "protocolo", "salon", "salón", "estudiante", "horario"],
    answer: "En Mi trabajo hoy encuentras horario, salones e info de estudiantes. En Recursos están protocolos, guías y materiales docentes."
  }
];

const MUSIPROFE_RESOURCE_WORDS = [
  "biblioteca", "recurso", "recursos", "material", "materiales", "repertorio",
  "cancion", "canciones", "lista", "pdf", "documento",
  "partitura", "partituras", "guia", "guía"
];

const MUSIPROFE_HELPER_WORDS = [
  "ayuda", "ayudas", "ayudame", "ayúdame", "buscar", "busca", "buscame", "búscame",
  "encontrar", "encuentra", "necesito", "quiero", "donde", "dónde", "esta", "está",
  "hay", "tienes", "tiene", "me", "el", "la", "los", "las", "del", "de", "para",
  "por", "favor", "link", "enlace", "recurso", "recursos", "material", "materiales",
  "biblioteca"
];

async function notifyTeacherShiftByEmail(payload) {
  const webhookUrl = String(TEACHER_SHIFT_EMAIL_WEBHOOK_URL || "").trim();
  if (!webhookUrl) return;
  if (payload?.action === "fin_jornada" && !TEACHER_SHIFT_NOTIFY_EXITS) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload || {})
    });
  } catch (error) {
    console.warn("No se pudo enviar la notificacion de jornada por correo", error);
  }
}

function isValidTeacherSiteQr(decodedText) {
  const value = normalizeQrValue(decodedText);
  return value === TEACHER_SITE_QR_ARRIVAL || value === TEACHER_SITE_QR_EXIT;
}

function getTeacherQrMessage(decodedText) {
  const value = normalizeQrValue(decodedText);

  if (value === TEACHER_SITE_QR_ARRIVAL) {
    return {
      status: "arrival",
      value,
      message: "QR de ingreso válido. Guardando registro..."
    };
  }

  if (value === TEACHER_SITE_QR_EXIT) {
    return {
      status: "exit",
      value,
      message: "QR de salida válido. Guardando registro..."
    };
  }

  if (TEACHER_SITE_QR_LUNCH.includes(value)) {
    return {
      status: "lunch",
      value,
      message: "Este QR es de almuerzo. Esta app todavía no registra almuerzos."
    };
  }

  return {
    status: "unknown",
    value,
    message: "Este QR no corresponde al registro de jornada de Musicala."
  };
}

function ensureTeacherShiftModal() {
  if (teacherShiftModal) return teacherShiftModal;

  const modal = document.createElement("div");
  modal.id = "teacherShiftModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Registro de jornada");

  modal.innerHTML = `
    <div class="shiftTool" role="document">
      <div class="shiftToolHead">
        <div>
          <p class="shiftEyebrow">Registro de jornada</p>
          <h2>Registro de jornada</h2>
        </div>
        <button class="btnGhost shiftClose" id="teacherShiftClose" type="button" aria-label="Cerrar">Cerrar</button>
      </div>

      <div class="shiftPerson">
        <div class="shiftAvatar" aria-hidden="true">DM</div>
        <div>
          <strong id="teacherShiftName">Docente</strong>
          <span id="teacherShiftEmail">correo</span>
        </div>
      </div>

      <div class="shiftDateLine">
        <span id="teacherShiftDate">Fecha Bogotá</span>
        <span id="teacherShiftTime">Hora Bogotá</span>
      </div>

      <div class="shiftModeGrid" aria-label="Modalidad de clase">
        <button class="shiftModeCard" type="button" data-shift-mode="sede">
          <strong>Estoy en sede · Escanear QR</strong>
          <span>Obligatorio para clases en sede</span>
        </button>
        <button class="shiftModeCard" type="button" data-shift-mode="hogar">
          <strong>Clase a hogar</strong>
          <span>Ya llegué a la ubicación de la clase</span>
          <small>Registro manual bajo responsabilidad del docente</small>
        </button>
        <button class="shiftModeCard" type="button" data-shift-mode="virtual">
          <strong>Clase virtual</strong>
          <span>Ya me conecté</span>
          <small>Registro manual bajo responsabilidad del docente</small>
        </button>
      </div>

      <section class="shiftModePanel" id="teacherShiftPanel" aria-live="polite">
        <p>Elige la modalidad para registrar tu evento de jornada.</p>
      </section>

      <section class="summaryBox">
        <div class="summaryHead">
          <strong>Mis registros de hoy</strong>
          <button class="btnGhost compact" id="teacherShiftRefresh" type="button">Actualizar</button>
        </div>
        <div id="teacherShiftSummary">Cargando registros...</div>
      </section>
    </div>
  `;

  const close = () => closeTeacherShiftModal();
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector("#teacherShiftClose")?.addEventListener("click", close);
  modal.querySelector("#teacherShiftRefresh")?.addEventListener("click", () => loadTeacherShiftSummary());
  modal.querySelectorAll("[data-shift-mode]").forEach((button) => {
    button.addEventListener("click", () => selectTeacherShiftMode(button.dataset.shiftMode));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  document.body.appendChild(modal);
  teacherShiftModal = modal;
  return modal;
}

function setTeacherShiftPanel(html) {
  const panel = $("#teacherShiftPanel", teacherShiftModal);
  if (panel) panel.innerHTML = html;
}

function updateTeacherShiftHeader() {
  const modal = ensureTeacherShiftModal();
  const now = bogotaParts();
  const name = getTeacherName();
  const email = emailKey(APP_STATE.activeUser);

  $("#teacherShiftName", modal).textContent = name;
  $("#teacherShiftEmail", modal).textContent = email;
  $("#teacherShiftDate", modal).textContent = `Fecha Bogotá: ${now.date}`;
  $("#teacherShiftTime", modal).textContent = `Hora Bogotá: ${now.time}`;
  $(".shiftAvatar", modal).textContent = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "DM";
}

async function stopTeacherQrReader() {
  if (!teacherQrReader || !teacherQrRunning) return;

  try {
    await teacherQrReader.stop();
  } catch (error) {
    console.warn("No se pudo detener el lector QR", error);
  } finally {
    try {
      teacherQrReader.clear();
    } catch (_) {}
    teacherQrRunning = false;
  }
}

function closeTeacherShiftModal() {
  if (!teacherShiftModal) return;
  stopTeacherQrReader();
  teacherShiftModal.hidden = true;
  document.body.style.overflow = "";
}

async function openTeacherShiftModal() {
  if (!APP_STATE.db) {
    toast("Firestore no está listo todavía. Intenta de nuevo en un momento.");
    return;
  }

  const modal = ensureTeacherShiftModal();
  updateTeacherShiftHeader();
  setTeacherShiftPanel("<p>Elige la modalidad para registrar tu evento de jornada.</p>");
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  await loadTeacherShiftSummary();
  if (APP_STATE.teacherShiftStatus.open) {
    renderOpenTeacherShiftNotice(APP_STATE.teacherShiftStatus.record);
  }
}

function renderOpenTeacherShiftNotice(openRecord = {}) {
  const modeLabel = getTeacherShiftModeLabel(openRecord?.modalidad);
  const sourceLabel = getTeacherShiftSourceLabel(openRecord?.source);
  const startTime = openRecord?.time || "hora no disponible";

  setSelectedShiftMode("");
  setTeacherShiftPanel(`
    <div class="openShiftNotice">
      <strong>Tienes una sesión abierta todavía</strong>
      <p>Registraste ingreso a las ${escapeHtml(startTime)} (${escapeHtml(modeLabel)} · ${escapeHtml(sourceLabel)}). Para registrar un nuevo ingreso primero debes cerrar esta jornada.</p>
      <div class="openShiftActions">
        <button class="btnGoogle" id="teacherCloseOpenShift" type="button">Sí, cerrar jornada</button>
        <button class="btnGhost" id="teacherKeepOpenShift" type="button">Mantener abierta</button>
      </div>
    </div>
  `);

  $("#teacherCloseOpenShift", teacherShiftModal)?.addEventListener("click", async (event) => {
    await saveTeacherClassStartRecord({
      modalidad: openRecord?.modalidad || "jornada",
      source: openRecord?.source === "qr_sede" ? "qr_sede" : "manual_fin",
      raw: "CIERRE_SESION_ABIERTA",
      action: "fin_jornada",
      button: event.currentTarget,
      successMessage: "Jornada cerrada. Ya puedes registrar un nuevo ingreso."
    });
  });

  $("#teacherKeepOpenShift", teacherShiftModal)?.addEventListener("click", () => {
    toast("La jornada sigue abierta.");
  });
}

async function fetchTodayTeacherShiftRecords() {
  if (!APP_STATE.db || !APP_STATE.activeUser) return [];

  const { date } = bogotaParts();
  const q = query(
    collection(APP_STATE.db, "teacherClassStartRecords"),
    where("email", "==", emailKey(APP_STATE.activeUser)),
    where("date", "==", date),
    limit(30)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => doc.data() || {})
    .sort((a, b) => Number(b.createdAtClient || 0) - Number(a.createdAtClient || 0));
}

function updateHeroJornadaButton() {
  const button = $(".heroPrimary[data-id='jornada']");
  if (!button) return;

  button.disabled = false;
  button.classList.remove("isFinalizing", "isDone", "hasOpenShift");
  button.removeAttribute("data-jornada-action");

  if (APP_STATE.teacherShiftStatus.open) {
    button.classList.add("hasOpenShift");
    button.dataset.jornadaAction = "close";
    button.textContent = "Tienes una jornada abierta";
    return;
  }

  button.textContent = "Registrar ingreso";
}

async function refreshTeacherJornadaStatus() {
  if (!APP_STATE.db || !APP_STATE.activeUser) {
    APP_STATE.teacherShiftStatus = { open: false, record: null };
    updateHeroJornadaButton();
    return;
  }

  try {
    const records = await fetchTodayTeacherShiftRecords();
    const openRecord = getOpenTeacherShift(records);
    APP_STATE.teacherShiftStatus = { open: !!openRecord, record: openRecord || null };
  } catch (error) {
    console.warn("No se pudo actualizar el estado de jornada", error);
  }

  updateHeroJornadaButton();
  scheduleTeacherShiftAutoCloseCheck();
}

function setSelectedShiftMode(mode) {
  teacherShiftModal?.querySelectorAll("[data-shift-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.shiftMode === mode);
  });
}

async function selectTeacherShiftMode(mode) {
  await stopTeacherQrReader();
  setSelectedShiftMode(mode);

  if (mode === "sede") {
    renderTeacherSiteQrPanel();
    return;
  }

  if (mode === "hogar" || mode === "virtual") {
    renderTeacherManualPanel(mode);
  }
}

function renderTeacherSiteQrPanel() {
  setTeacherShiftPanel(`
    <div class="reader">
      <div class="readerTop">
        <div>
          <strong>Clase en sede</strong>
          <span>Escanea el QR autorizado de ingreso o salida.</span>
        </div>
      </div>
      <label class="fieldLabel" for="teacherCameraSelect">Cámara</label>
      <select id="teacherCameraSelect" class="shiftSelect">
        <option value="">Cargando cámaras...</option>
      </select>
      <div id="teacherQrReader" class="qrBox"></div>
      <div class="readerActions">
        <button class="btnGoogle" id="teacherQrStart" type="button">Iniciar cámara</button>
        <button class="btnGhost" id="teacherQrStop" type="button">Detener</button>
      </div>
      <div class="readerReadout" id="teacherQrReadout" aria-live="polite"></div>
      <div class="readerResult" id="teacherQrResult">Esperando lectura de QR.</div>
    </div>
  `);

  const startBtn = $("#teacherQrStart", teacherShiftModal);
  const stopBtn = $("#teacherQrStop", teacherShiftModal);
  const cameraSelect = $("#teacherCameraSelect", teacherShiftModal);

  startBtn?.addEventListener("click", () => startTeacherQrReader());
  stopBtn?.addEventListener("click", () => stopTeacherQrReader());

  loadTeacherCameras(cameraSelect);
}

async function loadTeacherCameras(select) {
  if (!select) return;
  if (!window.Html5Qrcode) {
    select.innerHTML = '<option value="">Lector QR no disponible</option>';
    return;
  }

  try {
    const cameras = await window.Html5Qrcode.getCameras();
    if (!cameras?.length) {
      select.innerHTML = '<option value="">No se detectaron cámaras</option>';
      return;
    }

    select.innerHTML = cameras
      .map((camera, index) => `<option value="${escapeHtml(camera.id)}">${escapeHtml(camera.label || `Cámara ${index + 1}`)}</option>`)
      .join("");
  } catch (error) {
    console.warn("No se pudieron listar cámaras", error);
    select.innerHTML = '<option value="">Permite la cámara para continuar</option>';
  }
}

async function startTeacherQrReader() {
  const result = $("#teacherQrResult", teacherShiftModal);
  const select = $("#teacherCameraSelect", teacherShiftModal);

  if (!window.Html5Qrcode) {
    if (result) result.textContent = "No se pudo cargar el lector QR.";
    return;
  }

  await stopTeacherQrReader();
  teacherQrReader = new window.Html5Qrcode("teacherQrReader");
  const cameraId = select?.value || undefined;

  try {
    teacherQrRunning = true;
    if (result) result.textContent = "Cámara activa. Escanea el QR de sede.";

    await teacherQrReader.start(
      cameraId || { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText) => handleTeacherQrDecoded(decodedText),
      () => {}
    );
  } catch (error) {
    teacherQrRunning = false;
    console.error("QR start error:", error);
    if (result) result.textContent = "No se pudo iniciar la cámara. Revisa permisos.";
  }
}

async function handleTeacherQrDecoded(decodedText) {
  const result = $("#teacherQrResult", teacherShiftModal);
  const readout = $("#teacherQrReadout", teacherShiftModal);
  console.info("[Musicala QR leído]", decodedText);
  await stopTeacherQrReader();

  const qrInfo = getTeacherQrMessage(decodedText);
  if (readout) {
    readout.textContent = `QR leído: ${qrInfo.value || "sin valor"}`;
  }

  if (qrInfo.status === "lunch" || qrInfo.status === "unknown") {
    if (result) result.textContent = qrInfo.message;
    toast(qrInfo.message);
    return;
  }

  if (result) result.textContent = qrInfo.message;
  await saveTeacherClassStartRecord({
    modalidad: "sede",
    source: "qr_sede",
    raw: decodedText,
    action: qrInfo.status === "exit" ? "fin_jornada" : "inicio_clase",
    successMessage: qrInfo.status === "exit" ? "Salida en sede guardada." : "Ingreso en sede guardado."
  });
}

function renderTeacherManualPanel(mode) {
  const isHome = mode === "hogar";
  const title = isHome ? "Clase a hogar" : "Clase virtual";
  const buttonText = isHome ? "Ya llegué a la ubicación de la clase" : "Ya me conecté";

  setTeacherShiftPanel(`
    <div class="manualPanel">
      <strong>${escapeHtml(title)}</strong>
      <p>Registro manual bajo responsabilidad del docente.</p>
      <div class="manualData">
        <span>${escapeHtml(getTeacherName())}</span>
        <span>${escapeHtml(emailKey(APP_STATE.activeUser))}</span>
      </div>
      <button class="btnGoogle" id="teacherManualConfirm" type="button">${escapeHtml(buttonText)}</button>
    </div>
  `);

  $("#teacherManualConfirm", teacherShiftModal)?.addEventListener("click", async (event) => {
    await saveTeacherClassStartRecord({
      modalidad: mode,
      source: isHome ? "manual_hogar" : "manual_virtual",
      raw: isHome ? "MANUAL_HOGAR" : "MANUAL_VIRTUAL",
      button: event.currentTarget
    });
  });
}

async function saveTeacherShiftRecordTransaction(user, payload) {
  const sessionRef = doc(APP_STATE.db, "teacherOpenShiftSessions", getTeacherShiftSessionId(user));
  const recordRef = doc(collection(APP_STATE.db, "teacherClassStartRecords"));

  await runTransaction(APP_STATE.db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    const session = sessionSnap.exists() ? sessionSnap.data() || {} : {};
    const sessionIsOpen = !!session.open && session.email === payload.email;

    if (payload.action === "inicio_clase" && sessionIsOpen) {
      const openError = new Error("OPEN_TEACHER_SHIFT");
      openError.openRecord = session.openRecord || session.lastRecord || session;
      throw openError;
    }

    transaction.set(recordRef, payload);

    if (payload.action === "fin_jornada") {
      transaction.set(sessionRef, {
        open: false,
        email: payload.email,
        uid: payload.uid,
        name: payload.name,
        closedAt: serverTimestamp(),
        closedAtClient: payload.createdAtClient,
        closeRecordId: recordRef.id,
        lastRecord: payload
      }, { merge: true });
      return;
    }

    transaction.set(sessionRef, {
      open: true,
      email: payload.email,
      uid: payload.uid,
      name: payload.name,
      openedAt: serverTimestamp(),
      openedAtClient: payload.createdAtClient,
      openRecordId: recordRef.id,
      openRecord: payload,
      lastRecord: payload
    }, { merge: true });
  });
}

/* ----------------------------------------------------------------------------
   Cola offline de registros de jornada
   - Si el docente marca ingreso/salida sin internet, el registro se guarda en
     este dispositivo (localStorage) y se reenvía a Firebase al reconectar o al
     volver a abrir la app.
---------------------------------------------------------------------------- */
const PENDING_SHIFTS_KEY = "musicala:pendingShifts";
let flushingPendingShifts = false;

function readPendingShifts() {
  try {
    const raw = localStorage.getItem(PENDING_SHIFTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

function writePendingShifts(list) {
  try {
    if (!list || !list.length) {
      localStorage.removeItem(PENDING_SHIFTS_KEY);
    } else {
      localStorage.setItem(PENDING_SHIFTS_KEY, JSON.stringify(list));
    }
  } catch (error) {
    console.warn("No se pudo guardar la cola offline de jornada", error);
  }
}

function isOfflineError(error) {
  if (!navigator.onLine) return true;
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "unavailable" ||
    code === "failed-precondition" ||
    message.includes("offline") ||
    message.includes("network") ||
    message.includes("backend") ||
    message.includes("could not reach")
  );
}

function queueOfflineShift(payload, { action } = {}) {
  // serverTimestamp() es un sentinel no serializable: se re-genera al reenviar.
  const { createdAt, ...storable } = payload;
  const list = readPendingShifts();
  list.push(storable);
  writePendingShifts(list);

  // Estado local optimista para que la UI refleje el registro de inmediato.
  APP_STATE.teacherShiftStatus = {
    open: action !== "fin_jornada",
    record: storable
  };
  updateHeroJornadaButton();

  toast(
    action === "fin_jornada"
      ? "Sin conexión. Cierre guardado en este dispositivo; se enviará al reconectar."
      : "Sin conexión. Ingreso guardado en este dispositivo; se enviará al reconectar."
  );
}

function pendingShiftsCount() {
  return readPendingShifts().length;
}

async function flushPendingShifts() {
  if (flushingPendingShifts) return;
  if (!navigator.onLine || !APP_STATE.db) return;

  const list = readPendingShifts();
  if (!list.length) return;

  flushingPendingShifts = true;
  const remaining = [];
  let sent = 0;

  try {
    for (const item of list) {
      const replayUser = { uid: item.uid || "", email: item.email || "" };
      const payload = { ...item, createdAt: serverTimestamp() };
      try {
        await saveTeacherShiftRecordTransaction(replayUser, payload);
        notifyTeacherShiftByEmail(payload);
        sent += 1;
      } catch (error) {
        if (error?.message === "OPEN_TEACHER_SHIFT") {
          // El servidor ya tiene una jornada abierta: descartamos el duplicado.
          console.warn("Registro offline descartado por jornada abierta", error);
          continue;
        }
        if (isOfflineError(error)) {
          // Seguimos sin conexión: conservamos este y los siguientes en orden.
          remaining.push(item);
        } else {
          console.error("No se pudo sincronizar un registro offline", error);
          remaining.push(item);
        }
      }
    }
  } finally {
    writePendingShifts(remaining);
    flushingPendingShifts = false;
  }

  if (sent) {
    toast(`${sent} registro${sent === 1 ? "" : "s"} de jornada sincronizado${sent === 1 ? "" : "s"}.`);
    await refreshTeacherJornadaStatus();
  }
}

async function saveTeacherClassStartRecord({
  modalidad,
  source,
  raw,
  button = null,
  action = "inicio_clase",
  successMessage = "Inicio de jornada guardado."
}) {
  if (!APP_STATE.activeUser) {
    toast("No hay sesión lista para guardar el registro.");
    return;
  }

  const user = APP_STATE.activeUser;
  const parts = bogotaParts();
  const payload = {
    role: "docente",
    email: emailKey(user),
    name: getTeacherName(),
    uid: user.uid || "",
    date: parts.date,
    time: parts.time,
    stamp: new Date().toISOString(),
    createdAt: serverTimestamp(),
    createdAtClient: Date.now(),
    action,
    modalidad,
    source,
    raw: String(raw || "")
  };

  // Sin conexión: guardamos el registro en el dispositivo y lo enviamos luego.
  if (!navigator.onLine || !APP_STATE.db) {
    queueOfflineShift(payload, { action });
    if (teacherShiftModal && !teacherShiftModal.hidden) {
      updateTeacherShiftHeader();
      if (action === "inicio_clase") renderOpenTeacherShiftNotice(payload);
    }
    return;
  }

  if (action === "inicio_clase") {
    await autoCloseStaleOpenShifts({ includeAll: false, silent: false });
  }

  try {
    setButtonBusy(button, true, "Guardando...");
    await saveTeacherShiftRecordTransaction(user, payload);
    notifyTeacherShiftByEmail(payload);
    toast(successMessage);
    if (teacherShiftModal && !teacherShiftModal.hidden) {
      updateTeacherShiftHeader();
      await loadTeacherShiftSummary();
      if (action === "inicio_clase") {
        renderOpenTeacherShiftNotice(payload);
      }
    }
  } catch (error) {
    if (error?.message === "OPEN_TEACHER_SHIFT") {
      const openRecord = error.openRecord || APP_STATE.teacherShiftStatus.record || {};
      APP_STATE.teacherShiftStatus = { open: true, record: openRecord };
      renderOpenTeacherShiftNotice(openRecord);
      updateHeroJornadaButton();
      toast("Tienes una sesión abierta todavía. Ciérrala antes de registrar otro ingreso.");
      return;
    }

    if (isOfflineError(error)) {
      queueOfflineShift(payload, { action });
      if (teacherShiftModal && !teacherShiftModal.hidden) {
        updateTeacherShiftHeader();
        if (action === "inicio_clase") renderOpenTeacherShiftNotice(payload);
      }
      return;
    }

    console.error("No se pudo guardar el registro de clase", error);
    toast("No se pudo guardar el registro. Revisa conexión o permisos.");
  } finally {
    setButtonBusy(button, false);
    await refreshTeacherJornadaStatus();
  }
}

async function loadTeacherShiftSummary() {
  const target = $("#teacherShiftSummary", teacherShiftModal);
  if (!target || !APP_STATE.db || !APP_STATE.activeUser) return;

  target.textContent = "Cargando registros...";

  try {
    const records = await fetchTodayTeacherShiftRecords();
    const openRecord = getOpenTeacherShift(records);
    APP_STATE.teacherShiftStatus = { open: !!openRecord, record: openRecord || null };
    updateHeroJornadaButton();

    if (!records.length) {
      target.textContent = "Aún no hay registros de jornada hoy.";
      return;
    }

    const rows = records
      .slice()
      .sort((a, b) => Number(a.createdAtClient || 0) - Number(b.createdAtClient || 0))
      .map((data) => {
        const actionLabel = getTeacherShiftActionLabel(data.action);
        const modalidadLabel = getTeacherShiftModeLabel(data.modalidad);
        const sourceLabel = getTeacherShiftSourceLabel(data.source);

        return `
          <tr>
            <td>${escapeHtml(actionLabel)}</td>
            <td>${escapeHtml(modalidadLabel)}</td>
            <td>${escapeHtml(data.time || "-")}</td>
            <td>${escapeHtml(sourceLabel)}</td>
          </tr>
        `;
      }).join("");

    target.innerHTML = `
      <div class="recordTableWrap">
        <table class="recordTable">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Modalidad</th>
              <th>Hora</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("No se pudo cargar el resumen", error);
    target.textContent = "No se pudo cargar el resumen de hoy.";
  }
}

/* ============================================================================
   11b) PANEL ADMIN
============================================================================ */
let adminPanelModal = null;
const ADMIN_STATE = {
  records: [],
  liveSessions: [],
  schedules: {},       // { email: scheduleDoc }
  overrides: {},       // { "email__date": overrideDoc }
  scheduleYear: Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date())),
  scheduleMonth: Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", month: "numeric" }).format(new Date())) - 1,
  academic: { objectives: [], budgets: [], hourLogs: [] },
  supportReports: [],
  supportProfiles: {},
  supportAcceptances: {},
  hubUsers: {},        // { email: hubUserDoc } gestionados en Firestore
  customButtons: [],   // botones personalizados creados desde el panel
  scheduleTeacher: "", // email del docente seleccionado en la pestaña Horarios
  loading: false,
  tab: "puntualidad",
  filters: {
    email: "",
    from: "",
    to: ""
  }
};

const PUNCTUALITY = {
  DEFAULT_GRACE: 5,
  WEEKDAYS: ["dom", "lun", "mar", "mie", "jue", "vie", "sab"],
  WEEKDAY_LABELS: {
    lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves",
    vie: "Viernes", sab: "Sábado", dom: "Domingo"
  }
};

function adminDefaultDateRange() {
  const { date } = bogotaParts();
  const today = date;
  const dt = new Date(today + "T00:00:00");
  dt.setDate(dt.getDate() - 30);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return { from: `${yyyy}-${mm}-${dd}`, to: today };
}

// Accesos rápidos de mes para el filtro (mes actual + los 5 anteriores).
function adminMonthPresets(count = 6) {
  const { date } = bogotaParts();
  let y = Number(date.slice(0, 4));
  let m = Number(date.slice(5, 7)) - 1; // 0-based
  const out = [];
  for (let i = 0; i < count; i++) {
    const mm = String(m + 1).padStart(2, "0");
    const lastDay = new Date(y, m + 1, 0).getDate();
    out.push({
      label: `${(MONTH_NAMES_ES[m] || "").slice(0, 3)} ${y}`,
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`
    });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return out;
}

function getAdminTeacherOptions({ includeDisabled = true } = {}) {
  const managed = ADMIN_STATE.hubUsers || {};
  const emails = new Set([
    ...Object.keys(HUB.USERS || {}),
    ...Object.keys(managed)
  ]);

  const entries = Array.from(emails).map((email) => {
    const base = HUB.USERS?.[email] || {};
    const md = managed[email] || {};
    const enabled = md.enabled === false ? false : true;
    return {
      email,
      label: md.label || md.name || base.label || email,
      enabled,
      managed: !!managed[email],
      isAdmin: ADMIN_EMAILS.includes(email)
    };
  })
    .filter((item) => includeDisabled || item.enabled)
    .sort((a, b) => a.label.localeCompare(b.label, "es"));

  return entries;
}

function refreshAdminTeacherFilterOptions() {
  const select = adminPanelModal ? $("#adminFilterEmail", adminPanelModal) : null;
  if (!select) return;
  const current = select.value || "";
  const options = getAdminTeacherOptions()
    .map((item) => `<option value="${escapeHtml(item.email)}">${escapeHtml(item.label)}${item.enabled ? "" : " · inhabilitado"}</option>`)
    .join("");
  select.innerHTML = `<option value="">Todos</option>${options}`;
  if (current && Array.from(select.options).some((opt) => opt.value === current)) select.value = current;
}

function ensureAdminPanelModal() {
  if (adminPanelModal) return adminPanelModal;

  const modal = document.createElement("div");
  modal.id = "adminPanelModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Panel admin");

  const teacherOptions = getAdminTeacherOptions()
    .map((item) => `<option value="${escapeHtml(item.email)}">${escapeHtml(item.label)}</option>`)
    .join("");

  const range = adminDefaultDateRange();
  ADMIN_STATE.filters.from = range.from;
  ADMIN_STATE.filters.to = range.to;

  modal.innerHTML = `
    <div class="shiftTool adminTool" role="document">
      <div class="shiftToolHead">
        <div>
          <p class="shiftEyebrow">Administración</p>
          <h2>Panel admin · Marcaciones docentes</h2>
        </div>
        <button class="btnGhost shiftClose" id="adminPanelClose" type="button" aria-label="Cerrar">Cerrar</button>
      </div>

      <div class="adminTabs" role="tablist">
        <button class="adminTab active" type="button" data-admin-tab="puntualidad" role="tab">Puntualidad</button>
        <button class="adminTab" type="button" data-admin-tab="marcaciones" role="tab">Marcaciones</button>
        <button class="adminTab" type="button" data-admin-tab="diario" role="tab">Jornadas por día</button>
        <button class="adminTab" type="button" data-admin-tab="mensual" role="tab">Estadísticas</button>
        <button class="adminTab" type="button" data-admin-tab="academica" role="tab">Académica</button>
        <button class="adminTab" type="button" data-admin-tab="horarios" role="tab">Horarios</button>
        <button class="adminTab" type="button" data-admin-tab="docentes" role="tab">Docentes</button>
        <button class="adminTab" type="button" data-admin-tab="botones" role="tab">Botones</button>
        <button class="adminTab" type="button" data-admin-tab="soporte" role="tab">Soporte y mejoras</button>
        <button class="adminTab" type="button" data-admin-tab="vivo" role="tab">En vivo</button>
      </div>

      <div class="adminFilters" id="adminFilters">
        <label>
          <span>Docente</span>
          <select id="adminFilterEmail">
            <option value="">Todos</option>
            ${teacherOptions}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input type="date" id="adminFilterFrom" value="${escapeHtml(range.from)}" />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" id="adminFilterTo" value="${escapeHtml(range.to)}" />
        </label>
        <button class="btnGoogle adminApply" id="adminFilterApply" type="button">Aplicar</button>
      </div>

      <div class="adminMonthChips" id="adminMonthChips">
        <span class="adminMonthChipsLabel">Mes rápido:</span>
        ${adminMonthPresets().map((p) => `
          <button class="adminMonthChip" type="button" data-from="${escapeHtml(p.from)}" data-to="${escapeHtml(p.to)}">${escapeHtml(p.label)}</button>
        `).join("")}
      </div>

      <div class="adminBody" id="adminBody">
        <p>Cargando…</p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  adminPanelModal = modal;

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeAdminPanel();
  });

  $("#adminPanelClose", modal)?.addEventListener("click", closeAdminPanel);

  modal.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.adminTab;
      setAdminTab(id);
    });
  });

  $("#adminFilterApply", modal)?.addEventListener("click", () => {
    ADMIN_STATE.filters.email = $("#adminFilterEmail", modal).value || "";
    ADMIN_STATE.filters.from = $("#adminFilterFrom", modal).value || "";
    ADMIN_STATE.filters.to = $("#adminFilterTo", modal).value || "";
    loadAdminData();
  });

  modal.querySelectorAll(".adminMonthChip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const from = chip.dataset.from || "";
      const to = chip.dataset.to || "";
      const fromInput = $("#adminFilterFrom", modal);
      const toInput = $("#adminFilterTo", modal);
      if (fromInput) fromInput.value = from;
      if (toInput) toInput.value = to;
      ADMIN_STATE.filters.email = $("#adminFilterEmail", modal).value || "";
      ADMIN_STATE.filters.from = from;
      ADMIN_STATE.filters.to = to;
      modal.querySelectorAll(".adminMonthChip").forEach((c) => c.classList.toggle("isActive", c === chip));
      loadAdminData();
    });
  });

  return modal;
}

function openAdminPanel() {
  if (!isAdminUser()) {
    toast("Sección reservada para administradores.");
    return;
  }
  const modal = ensureAdminPanelModal();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  autoCloseStaleOpenShifts({ includeAll: true, silent: true });
  setAdminTab(ADMIN_STATE.tab || "marcaciones");
  loadAdminData();
}

function closeAdminPanel() {
  if (!adminPanelModal) return;
  adminPanelModal.hidden = true;
  document.body.style.overflow = "";
}

function setAdminTab(tabId) {
  ADMIN_STATE.tab = tabId;
  if (!adminPanelModal) return;

  adminPanelModal.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.adminTab === tabId);
  });

  const filters = $("#adminFilters", adminPanelModal);
  if (filters) filters.style.display = (tabId === "vivo" || tabId === "horarios" || tabId === "docentes" || tabId === "botones" || tabId === "soporte") ? "none" : "";

  renderAdminBody();
}

async function loadAdminData() {
  if (!APP_STATE.db || !isAdminUser()) return;
  const body = $("#adminBody", adminPanelModal);
  if (body) body.innerHTML = "<p>Cargando registros…</p>";
  ADMIN_STATE.loading = true;

  try {
    if (!Object.keys(ADMIN_STATE.hubUsers || {}).length) {
      ADMIN_STATE.hubUsers = await fetchHubUsers();
      refreshAdminTeacherFilterOptions();
    }

    if (ADMIN_STATE.tab === "vivo") {
      ADMIN_STATE.liveSessions = await fetchAdminLiveSessions();
    } else if (ADMIN_STATE.tab === "horarios") {
      const [schedules, overrides] = await Promise.all([
        fetchAdminSchedules(),
        fetchScheduleOverridesForYear(ADMIN_STATE.scheduleYear)
      ]);
      ADMIN_STATE.schedules = schedules;
      ADMIN_STATE.overrides = overrides;
    } else if (ADMIN_STATE.tab === "academica") {
      ADMIN_STATE.academic = await fetchAdminAcademic();
    } else if (ADMIN_STATE.tab === "docentes") {
      ADMIN_STATE.hubUsers = await fetchHubUsers();
      await loadSupportAdminData();
      refreshAdminTeacherFilterOptions();
    } else if (ADMIN_STATE.tab === "botones") {
      ADMIN_STATE.customButtons = await fetchCustomButtons();
      applyCustomButtons(ADMIN_STATE.customButtons);
    } else if (ADMIN_STATE.tab === "soporte") {
      ADMIN_STATE.supportReports = await fetchSupportReportsFor();
    } else {
      const [records] = await Promise.all([fetchAdminRecords()]);
      ADMIN_STATE.records = records;
      // Para puntualidad y estadísticas necesitamos horarios + overrides del rango.
      if (ADMIN_STATE.tab === "puntualidad" || ADMIN_STATE.tab === "mensual") {
        const [schedules, overrides] = await Promise.all([
          fetchAdminSchedules(),
          fetchAdminOverrides()
        ]);
        ADMIN_STATE.schedules = schedules;
        ADMIN_STATE.overrides = overrides;
      }
    }
  } catch (error) {
    console.error("Admin load error", error);
    if (body) body.innerHTML = `<p>No se pudieron cargar los datos. ${escapeHtml(error?.message || "")}</p>`;
    ADMIN_STATE.loading = false;
    return;
  }

  ADMIN_STATE.loading = false;
  renderAdminBody();
}

async function fetchAdminRecords() {
  const { email, from, to } = ADMIN_STATE.filters;
  const constraints = [];
  if (email) constraints.push(where("email", "==", email));
  if (from) constraints.push(where("date", ">=", from));
  if (to) constraints.push(where("date", "<=", to));
  constraints.push(orderBy("date", "desc"));
  constraints.push(limit(1000));

  const q = query(collection(APP_STATE.db, "teacherClassStartRecords"), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

// Lunes de la semana (lun–dom) que contiene una fecha.
function mondayOfDate(dateStr) {
  const order = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
  return addDaysToDateStr(dateStr, -order.indexOf(weekdayKeyFromDate(dateStr)));
}

// Rango que cubre todas las semanas lun–dom que tocan un mes.
function scheduleMonthWeekRange(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  const first = `${year}-${mm}-01`;
  const last = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
  return { from: mondayOfDate(first), to: addDaysToDateStr(mondayOfDate(last), 6) };
}

async function fetchAdminLiveSessions() {
  const q = query(
    collection(APP_STATE.db, "teacherOpenShiftSessions"),
    where("open", "==", true),
    limit(200)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
}

/* ============================================================================
   11c) HORARIOS Y PUNTUALIDAD
============================================================================ */
async function fetchAdminSchedules() {
  const snapshot = await getDocs(collection(APP_STATE.db, "teacherSchedules"));
  const map = {};
  snapshot.forEach((d) => { map[d.id] = { email: d.id, ...(d.data() || {}) }; });
  return map;
}

async function fetchAdminOverrides() {
  const { from, to } = ADMIN_STATE.filters;
  const constraints = [];
  if (from) constraints.push(where("date", ">=", from));
  if (to) constraints.push(where("date", "<=", to));
  const q = constraints.length
    ? query(collection(APP_STATE.db, "teacherScheduleOverrides"), ...constraints)
    : collection(APP_STATE.db, "teacherScheduleOverrides");
  const snapshot = await getDocs(q);
  const map = {};
  snapshot.forEach((d) => { map[d.id] = { id: d.id, ...(d.data() || {}) }; });
  return map;
}

async function fetchScheduleOverridesForYear(year) {
  const y = Number(year) || Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const q = query(
    collection(APP_STATE.db, "teacherScheduleOverrides"),
    where("date", ">=", `${y}-01-01`),
    where("date", "<=", `${y}-12-31`),
    limit(2000)
  );
  const snapshot = await getDocs(q);
  const map = {};
  snapshot.forEach((d) => { map[d.id] = { id: d.id, ...(d.data() || {}) }; });
  return map;
}

function overrideId(email, date) {
  return `${email}__${date}`;
}

/* ---- Estadísticas del módulo Bitácora Académica ---- */
async function fetchAdminAcademic() {
  const read = async (name) => {
    const snap = await getDocs(collection(APP_STATE.db, name));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  };
  const [objectives, budgets, hourLogs] = await Promise.all([
    read("academicObjectives"),
    read("academicTaskBudgets"),
    read("academicTaskHourLogs")
  ]);
  return { objectives, budgets, hourLogs };
}

function academicNum(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function academicHours(n) {
  return `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })} h`;
}

function academicStateLabel(value) {
  const s = String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (s.startsWith("cumpl") || s.includes("termin") || s.includes("finaliz") || s.includes("aprob")) return "Cumplido";
  if (s.includes("curso") || s.includes("progreso") || s.includes("desarrollo")) return "En curso";
  return "Pendiente";
}

async function saveTeacherSchedule(email, data) {
  const ref = doc(APP_STATE.db, "teacherSchedules", email);
  await setDoc(ref, {
    ...data,
    email,
    updatedBy: emailKey(APP_STATE.activeUser),
    updatedAt: serverTimestamp()
  });
}

async function saveScheduleOverride(email, date, data) {
  const ref = doc(APP_STATE.db, "teacherScheduleOverrides", overrideId(email, date));
  await setDoc(ref, {
    email,
    date,
    ...data,
    updatedBy: emailKey(APP_STATE.activeUser),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function deleteScheduleOverride(email, date) {
  const ref = doc(APP_STATE.db, "teacherScheduleOverrides", overrideId(email, date));
  await deleteDoc(ref);
}

// "YYYY-MM-DD" -> clave de día de semana ("lun".."dom") en zona Bogotá.
const WEEKDAY_MAP = { Sun: "dom", Mon: "lun", Tue: "mar", Wed: "mie", Thu: "jue", Fri: "vie", Sat: "sab" };
function weekdayKeyFromDate(dateStr) {
  // Anclamos a mediodía Bogotá (-05) para evitar saltos por zona horaria.
  const dt = new Date(`${dateStr}T12:00:00-05:00`);
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota", weekday: "short"
  }).format(dt);
  return WEEKDAY_MAP[short] || "dom";
}

function timeToMinutes(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatTime12h(hhmm) {
  const minutes = timeToMinutes(hhmm);
  if (minutes == null) return "";
  const h24 = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const period = h24 >= 12 ? "pm" : "am";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

function scheduleRangeText(start, end) {
  const startLabel = formatTime12h(start);
  const endLabel = formatTime12h(end);
  if (!startLabel) return "Sin jornada programada";
  return endLabel ? `${startLabel} a ${endLabel}` : startLabel;
}

function addDaysToDateStr(dateStr, days) {
  const dt = new Date(`${dateStr}T12:00:00-05:00`);
  dt.setDate(dt.getDate() + Number(days || 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(dt);
}

function longDateLabel(dateStr) {
  const dt = new Date(`${dateStr}T12:00:00-05:00`);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(dt);
}

async function loadTeacherScheduleForActiveUser() {
  const email = emailKey(APP_STATE.activeUser);
  APP_STATE.teacherSchedule = { loading: true, schedule: null, overrides: {} };
  if (!APP_STATE.db || !email) {
    APP_STATE.teacherSchedule.loading = false;
    return;
  }

  try {
    const schedSnap = await getDoc(doc(APP_STATE.db, "teacherSchedules", email));
    const schedule = schedSnap.exists() ? { email, ...(schedSnap.data() || {}) } : null;
    const { date: today } = bogotaParts();
    const dates = Array.from({ length: 14 }, (_, i) => addDaysToDateStr(today, i));
    const overridePairs = await Promise.all(dates.map(async (date) => {
      try {
        const snap = await getDoc(doc(APP_STATE.db, "teacherScheduleOverrides", overrideId(email, date)));
        return snap.exists() ? [date, { id: snap.id, ...(snap.data() || {}) }] : null;
      } catch (_) {
        return null;
      }
    }));
    APP_STATE.teacherSchedule = {
      loading: false,
      schedule,
      overrides: Object.fromEntries(overridePairs.filter(Boolean))
    };
  } catch (error) {
    console.warn("No se pudo cargar el horario docente", error);
    APP_STATE.teacherSchedule = { loading: false, schedule: null, overrides: {} };
  }
}

function getTeacherScheduleForDate(date) {
  const schedule = APP_STATE.teacherSchedule?.schedule;
  if (!schedule || schedule.type !== "fijo") return null;
  const ov = APP_STATE.teacherSchedule?.overrides?.[date];
  if (ov) {
    const enabled = ov.enabled !== false && ov.works !== false && !ov.dayOff;
    return {
      start: enabled ? (ov.start || "") : "",
      end: enabled ? (ov.end || "") : "",
      excused: !!ov.excused,
      dayOff: !enabled,
      note: ov.note || ov.reason || (!enabled ? "No viene" : ""),
      source: "override"
    };
  }
  const day = schedule.weekly?.[weekdayKeyFromDate(date)];
  if (!day?.start) return null;
  return { start: day.start, end: day.end || "", excused: false, note: "", source: "weekly" };
}

function scheduleTimeText(item) {
  if (!item) return "Sin jornada programada";
  if (item.dayOff) return item.note || "No viene";
  if (item.excused && item.note) return item.note;
  if (item.excused) return "Horario justificado";
  return scheduleRangeText(item.start, item.end);
}

function scheduleCalendarDisplayItem(item) {
  if (!item) return null;
  if (item.dayOff) {
    return { ...item, excused: false, start: item.note || "No viene", end: "" };
  }
  if (item.excused && item.note) {
    return { ...item, excused: false, start: item.note, end: "" };
  }
  if (item.start) {
    const s = timeToMinutes(item.start), e = timeToMinutes(item.end);
    const lunch = s != null && e != null && e - s > 360; // más de 6h → incluye almuerzo
    return { ...item, start: scheduleRangeText(item.start, item.end), end: "", lunch };
  }
  return item;
}

function renderTeacherScheduleNudge() {
  const schedule = APP_STATE.teacherSchedule?.schedule;
  if (!schedule || schedule.type !== "fijo") return "";

  const { date: today } = bogotaParts();
  const tomorrow = addDaysToDateStr(today, 1);
  const items = [
    { label: "Hoy", date: today, item: getTeacherScheduleForDate(today) },
    { label: "Mañana", date: tomorrow, item: getTeacherScheduleForDate(tomorrow) }
  ];

  const rows = items.map(({ label, date, item }) => {
    const text = scheduleTimeText(item);
    const note = item?.note && text !== item.note ? `<small>${escapeHtml(item.note)}</small>` : "";
    const empty = !item ? " isOff" : "";
    return `
      <div class="heroScheduleItem${empty}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(text)}</span>
        <small>${escapeHtml(longDateLabel(date))}</small>
        ${note}
      </div>
    `;
  }).join("");

  return `<div class="heroScheduleNudge" aria-label="Resumen de horario de hoy y mañana">${rows}</div>`;
}

function openTeacherScheduleView() {
  const schedule = APP_STATE.teacherSchedule?.schedule;
  if (!schedule || schedule.type !== "fijo") {
    toast("Tu horario es flexible; coordinación lo ajusta por día.");
    return;
  }

  const { date: today } = bogotaParts();
  const currentYear = Number(today.slice(0, 4));
  const tomorrow = addDaysToDateStr(today, 1);
  const todayItem = getTeacherScheduleForDate(today);
  const tomorrowItem = getTeacherScheduleForDate(tomorrow);
  const days = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
  const weeklyRows = days.map((wd) => {
    const day = schedule.weekly?.[wd] || {};
    return `
      <div class="teacherScheduleRow ${day.start ? "" : "isOff"}">
        <strong>${escapeHtml(PUNCTUALITY.WEEKDAY_LABELS[wd])}</strong>
        <span>${day.start ? escapeHtml(scheduleRangeText(day.start, day.end)) : "Sin jornada"}</span>
      </div>
    `;
  }).join("");
  const upcomingRows = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateStr(today, i);
    const item = getTeacherScheduleForDate(date);
    const note = item?.note ? `<small>${escapeHtml(item.note)}</small>` : "";
    return `
      <div class="teacherScheduleRow ${item ? "" : "isOff"}">
        <strong>${escapeHtml(i === 0 ? "Hoy" : i === 1 ? "Mañana" : longDateLabel(date))}</strong>
        <span>${escapeHtml(scheduleTimeText(item))}</span>
        ${note}
      </div>
    `;
  }).join("");

  const modal = document.createElement("div");
  modal.className = "teacherScheduleModal";
  modal.innerHTML = `
    <div class="teacherScheduleCard" role="dialog" aria-modal="true" aria-label="Horario docente">
      <div class="teacherScheduleHead">
        <div>
          <p>Horario</p>
          <h2>${escapeHtml(getTeacherName())}</h2>
        </div>
        <button class="btnGhost shiftClose" id="teacherScheduleClose" type="button" aria-label="Cerrar">Cerrar</button>
      </div>
      <div class="teacherScheduleHero">
        <div>
          <span>Hoy</span>
          <strong>${escapeHtml(scheduleTimeText(todayItem))}</strong>
          <small>${escapeHtml(longDateLabel(today))}</small>
        </div>
        <div>
          <span>Mañana</span>
          <strong>${escapeHtml(scheduleTimeText(tomorrowItem))}</strong>
          <small>${escapeHtml(longDateLabel(tomorrow))}</small>
        </div>
      </div>
      <section>
        <h3>Próximos días</h3>
        <div class="teacherScheduleList">${upcomingRows}</div>
      </section>
      <section>
        <h3>Semana fija</h3>
        <div class="teacherScheduleList">${weeklyRows}</div>
      </section>
      <section class="teacherAnnualSection">
        <div class="teacherAnnualHead">
          <h3>Calendario</h3>
          <div class="scheduleMonthNav">
            <button class="btnGhost teacherMonthStep" type="button" data-step="-1" aria-label="Mes anterior">‹</button>
            <strong id="teacherMonthLabel"></strong>
            <button class="btnGhost teacherMonthStep" type="button" data-step="1" aria-label="Mes siguiente">›</button>
            <button class="btnGhost teacherMonthToday" type="button">Hoy</button>
          </div>
        </div>
        <div id="teacherMonthGrid" class="scheduleSoloWrap"></div>
      </section>
      <p class="teacherScheduleNote">Si coordinación agrega una excepción, aparecerá aquí sobre tu horario semanal.</p>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
  };
  document.body.style.overflow = "hidden";
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  $("#teacherScheduleClose", modal)?.addEventListener("click", close);

  let shownYear = currentYear;
  let shownMonth = Number(today.slice(5, 7)) - 1;
  const paintMonth = () => {
    const label = $("#teacherMonthLabel", modal);
    const grid = $("#teacherMonthGrid", modal);
    if (label) label.textContent = `${MONTH_NAMES_ES[shownMonth]} ${shownYear}`;
    if (grid) grid.innerHTML = renderScheduleMonthSolo((date) => scheduleCalendarDisplayItem(getTeacherScheduleForDate(date)), shownYear, shownMonth, today);
  };
  paintMonth();
  modal.querySelectorAll(".teacherMonthStep").forEach((btn) => {
    btn.addEventListener("click", () => {
      shownMonth += Number(btn.dataset.step) || 0;
      if (shownMonth < 0) { shownMonth = 11; shownYear -= 1; }
      else if (shownMonth > 11) { shownMonth = 0; shownYear += 1; }
      paintMonth();
    });
  });
  $(".teacherMonthToday", modal)?.addEventListener("click", () => {
    shownYear = currentYear;
    shownMonth = Number(today.slice(5, 7)) - 1;
    paintMonth();
  });
}

function minutesToLabel(mins) {
  if (mins == null || !Number.isFinite(mins)) return "-";
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h ? `${sign}${h}h ${String(m).padStart(2, "0")}m` : `${sign}${m}m`;
}

// Devuelve el horario esperado para (email, date): primero override, luego semanal (fijo).
function getExpectedSchedule(email, date) {
  const ov = ADMIN_STATE.overrides[overrideId(email, date)];
  if (ov) {
    if (ov.enabled === false || ov.works === false) {
      return {
        start: "",
        end: "",
        modalidad: ov.modalidad || ov.modality || "",
        graceMinutes: Number.isFinite(Number(ov.graceMinutes)) ? Number(ov.graceMinutes) : null,
        excused: true,
        dayOff: true,
        note: ov.note || ov.reason || "No viene",
        source: "override"
      };
    }
    return {
      start: ov.start || "",
      end: ov.end || "",
      modalidad: ov.modalidad || ov.modality || "",
      graceMinutes: Number.isFinite(Number(ov.graceMinutes)) ? Number(ov.graceMinutes) : null,
      excused: !!ov.excused,
      dayOff: false,
      note: ov.note || ov.reason || "",
      source: "override"
    };
  }
  const sched = ADMIN_STATE.schedules[email];
  if (sched && sched.type === "fijo" && sched.weekly) {
    const day = sched.weekly[weekdayKeyFromDate(date)];
    if (day && day.start) {
      return {
        start: day.start,
        end: day.end || "",
        modalidad: day.modalidad || day.modality || "",
        graceMinutes: null,
        excused: false,
        dayOff: false,
        note: day.note || day.notes || "",
        source: "weekly"
      };
    }
  }
  return null; // sin horario esperado configurado
}

function getGraceMinutes(email) {
  const sched = ADMIN_STATE.schedules[email];
  const g = Number(sched?.graceMinutes);
  return Number.isFinite(g) ? g : PUNCTUALITY.DEFAULT_GRACE;
}

// Evalúa puntualidad de un día-docente a partir de las marcas emparejadas.
function evaluatePunctuality(email, date, firstInTime, lastOutTime) {
  const expected = getExpectedSchedule(email, date);
  const overrideGrace = Number(expected?.graceMinutes);
  const grace = Number.isFinite(overrideGrace) ? overrideGrace : getGraceMinutes(email);

  if (!expected || !expected.start) {
    if (expected?.dayOff || expected?.excused) {
      return { status: "justificado", label: expected?.dayOff ? "No viene" : "Justificado", lateMin: null, earlyMin: null, expected, grace };
    }
    return { status: "sin_horario", label: "Sin horario", lateMin: null, earlyMin: null, expected, grace };
  }
  if (expected.excused) {
    return { status: "justificado", label: "Justificado", lateMin: null, earlyMin: null, expected, grace };
  }
  if (!firstInTime) {
    return { status: "ausente", label: "Ausente", lateMin: null, earlyMin: null, expected, grace };
  }

  const expStart = timeToMinutes(expected.start);
  const realStart = timeToMinutes(firstInTime);
  let lateMin = null;
  if (expStart != null && realStart != null) lateMin = realStart - expStart;

  let earlyMin = null;
  if (expected.end && lastOutTime) {
    const expEnd = timeToMinutes(expected.end);
    const realEnd = timeToMinutes(lastOutTime);
    if (expEnd != null && realEnd != null) earlyMin = expEnd - realEnd; // positivo = salió antes
  }

  let status = "a_tiempo";
  let label = "A tiempo";
  if (lateMin != null && lateMin > grace) {
    status = "tarde";
    label = `Tarde ${minutesToLabel(lateMin)}`;
  } else if (earlyMin != null && earlyMin > grace) {
    status = "salida_temprana";
    label = `Salió ${minutesToLabel(earlyMin)} antes`;
  }

  return { status, label, lateMin, earlyMin, expected, grace };
}

const PUNCTUALITY_BADGE = {
  a_tiempo: "ok",
  tarde: "late",
  salida_temprana: "early",
  ausente: "absent",
  justificado: "excused",
  sin_horario: "none"
};

function renderAdminBody() {
  const body = $("#adminBody", adminPanelModal);
  if (!body) return;
  if (ADMIN_STATE.loading) {
    body.innerHTML = "<p>Cargando…</p>";
    return;
  }

  if (ADMIN_STATE.tab === "puntualidad") return renderAdminPuntualidad(body);
  if (ADMIN_STATE.tab === "marcaciones") return renderAdminMarcaciones(body);
  if (ADMIN_STATE.tab === "diario") return renderAdminDiario(body);
  if (ADMIN_STATE.tab === "mensual") return renderAdminMensual(body);
  if (ADMIN_STATE.tab === "academica") return renderAdminAcademica(body);
  if (ADMIN_STATE.tab === "docentes") return renderAdminDocentes(body);
  if (ADMIN_STATE.tab === "horarios") return renderAdminHorarios(body);
  if (ADMIN_STATE.tab === "botones") return renderAdminBotones(body);
  if (ADMIN_STATE.tab === "soporte") return renderAdminSupport(body);
  if (ADMIN_STATE.tab === "vivo") return renderAdminVivo(body);
}

function renderAdminSupport(body) {
  const reports = ADMIN_STATE.supportReports || [];
  const pending = reports.filter((item) => !["cumplido", "descartado"].includes(item.status)).length;
  body.innerHTML = `<p class="adminMeta">${reports.length} reporte(s) recibidos · ${pending} pendiente(s) de cierre. Actualiza el estado y explica la mejora para que la docente la vea desde Soporte.</p>${reports.length ? `<div class="supportAdminList">${reports.map((report) => `<article class="supportAdminCard">${renderSupportReport(report, true)}<label>Estado<select data-support-status="${escapeHtml(report.id)}"><option value="nuevo" ${report.status === "nuevo" ? "selected" : ""}>Recibido</option><option value="en_revision" ${report.status === "en_revision" ? "selected" : ""}>En revisión</option><option value="en_progreso" ${report.status === "en_progreso" ? "selected" : ""}>En progreso</option><option value="cumplido" ${report.status === "cumplido" ? "selected" : ""}>Mejora realizada</option><option value="descartado" ${report.status === "descartado" ? "selected" : ""}>No se implementará</option></select></label><label>Actualización visible para la docente<textarea data-support-response="${escapeHtml(report.id)}" rows="3" maxlength="1500" placeholder="Ej.: Corregimos el botón y ya puedes usarlo.">${escapeHtml(report.adminResponse || "")}</textarea></label><button class="btnGoogle supportSave" type="button" data-support-save="${escapeHtml(report.id)}">Guardar avance</button></article>`).join("")}</div>` : '<p class="adminNote">Aún no hay reportes de soporte.</p>'}`;
  body.querySelectorAll("[data-support-save]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.supportSave;
    const status = body.querySelector(`[data-support-status="${id}"]`)?.value || "nuevo";
    const adminResponse = body.querySelector(`[data-support-response="${id}"]`)?.value?.trim() || "";
    button.disabled = true; button.textContent = "Guardando…";
    try {
      await updateDoc(doc(APP_STATE.db, "supportReports", id), { status, adminResponse, updatedAt: serverTimestamp(), updatedBy: emailKey(APP_STATE.activeUser) });
      const item = ADMIN_STATE.supportReports.find((report) => report.id === id);
      if (item) Object.assign(item, { status, adminResponse });
      toast("Avance guardado y visible para la docente ✅"); renderAdminSupport(body);
    } catch (error) { console.error("No se pudo actualizar el reporte", error); toast("No pude guardar el avance."); button.disabled = false; button.textContent = "Guardar avance"; }
  }));
}

function renderAdminMarcaciones(body) {
  const records = ADMIN_STATE.records.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return Number(b.createdAtClient || 0) - Number(a.createdAtClient || 0);
  });

  if (!records.length) {
    body.innerHTML = "<p>No hay marcaciones en el rango seleccionado.</p>";
    return;
  }

  const rows = records.map((r) => {
    const flags = [];
    if (r.voided) flags.push(`<span class="admTag admTagVoid">Anulada</span>`);
    else if (r.manualCorrection) flags.push(`<span class="admTag admTagFix" title="${escapeHtml(r.correctionReason || "")}">Corregida</span>`);
    if (r.statusOverride === "puntual") flags.push(`<span class="admTag admTagOk">Puntual (admin)</span>`);
    else if (r.statusOverride === "justificado") flags.push(`<span class="admTag admTagInfo">Justificado</span>`);
    return `
    <tr class="${r.voided ? "admRowVoid" : ""}">
      <td>${escapeHtml(r.date || "-")}</td>
      <td>${escapeHtml(r.time || "-")}</td>
      <td>${escapeHtml(r.name || r.email || "-")}</td>
      <td>${escapeHtml(getTeacherShiftActionLabel(r.action))}</td>
      <td>${escapeHtml(getTeacherShiftModeLabel(r.modalidad))}</td>
      <td>${escapeHtml(getTeacherShiftSourceLabel(r.source))} ${flags.join(" ")}</td>
      <td><button class="btnGhost btnSmall admEditBtn" type="button" data-edit="${escapeHtml(r.id)}">Editar</button></td>
    </tr>
  `;
  }).join("");

  const activas = records.filter((r) => !r.voided).length;
  body.innerHTML = `
    <p class="adminMeta">${activas} marcaciones${records.length !== activas ? ` · ${records.length - activas} anuladas` : ""}</p>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Fecha</th><th>Hora</th><th>Docente</th><th>Tipo</th><th>Modalidad</th><th>Fuente</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  body.querySelectorAll(".admEditBtn").forEach((btn) => {
    btn.addEventListener("click", () => openAdminEditRecordModal(btn.dataset.edit));
  });
}

/* ---- Edición / corrección de una marcación (solo admin) ---- */
function findAdminRecord(id) {
  return (ADMIN_STATE.records || []).find((r) => r.id === id) || null;
}

function stampFromDateTime(date, time) {
  // Reconstruye un ISO aproximado en zona Bogotá (UTC-5) para una fecha/hora HH:mm.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !/^\d{1,2}:\d{2}$/.test(String(time || ""))) return null;
  const [h, m] = time.split(":");
  return `${date}T${String(h).padStart(2, "0")}:${m}:00-05:00`;
}

function openAdminEditRecordModal(id) {
  if (!isAdminUser()) { toast("No tienes permisos para editar marcaciones."); return; }
  const r = findAdminRecord(id);
  if (!r) { toast("No se encontró la marcación."); return; }

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Editar / corregir marcación</h3>
      <p class="adminSubSub">${escapeHtml(r.name || r.email || "")} · ${escapeHtml(r.date || "")}</p>
      <p class="adminSubNote">Editar esta marcación <strong>no cambia</strong> el horario semanal del docente. Solo corrige este registro puntual.</p>
      <div class="adminOverrideGrid">
        <label>Hora (HH:mm)
          <input type="time" id="edTime" value="${escapeHtml(r.time || "")}" />
        </label>
        <label>Tipo
          <select id="edAction">
            <option value="inicio_clase" ${r.action !== "fin_jornada" ? "selected" : ""}>Ingreso</option>
            <option value="fin_jornada" ${r.action === "fin_jornada" ? "selected" : ""}>Salida</option>
          </select>
        </label>
        <label>Modalidad
          <select id="edMod">
            ${["sede", "hogar", "virtual", "jornada"].map((m) => `<option value="${m}" ${(r.modalidad || "") === m ? "selected" : ""}>${escapeHtml(getTeacherShiftModeLabel(m))}</option>`).join("")}
          </select>
        </label>
        <label>Estado manual
          <select id="edStatus">
            <option value="" ${!r.statusOverride ? "selected" : ""}>Automático (calculado)</option>
            <option value="puntual" ${r.statusOverride === "puntual" ? "selected" : ""}>Contar como puntual</option>
            <option value="justificado" ${r.statusOverride === "justificado" ? "selected" : ""}>Justificado</option>
          </select>
        </label>
      </div>
      <p class="adminSubNote"><strong>Contar como puntual</strong> conserva la hora real registrada pero elimina la tardanza de las estadísticas. El motivo queda en el historial.</p>
      <label>Nota administrativa
        <input type="text" id="edNotes" maxlength="200" value="${escapeHtml(r.adminNotes || "")}" placeholder="Opcional" />
      </label>
      <label>Motivo de la corrección (obligatorio)
        <input type="text" id="edReason" maxlength="200" placeholder="Ej: ese día se autorizó un ingreso diferente por reunión externa." />
      </label>
      <div class="adminSubActions">
        ${r.voided ? "<span></span>" : `<button class="btnGhost adminDanger" id="edVoid" type="button">Anular marcación</button>`}
        <div>
          <button class="btnGhost" id="edCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="edSave" type="button">Guardar corrección</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#edCancel", dialog)?.addEventListener("click", close);

  $("#edSave", dialog)?.addEventListener("click", async () => {
    const reason = $("#edReason", dialog).value.trim();
    if (!reason) { toast("Escribe el motivo de la corrección para poder guardar."); $("#edReason", dialog).focus(); return; }
    const time = $("#edTime", dialog).value || r.time || "";
    const patch = {
      time,
      stamp: stampFromDateTime(r.date, time) || r.stamp || null,
      action: $("#edAction", dialog).value,
      modalidad: $("#edMod", dialog).value,
      adminNotes: $("#edNotes", dialog).value.trim(),
      statusOverride: $("#edStatus", dialog).value
    };
    const saveBtn = $("#edSave", dialog);
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";
    const ok = await saveAdminRecordCorrection(id, patch, reason);
    if (ok) { close(); renderAdminBody(); }
    else { saveBtn.disabled = false; saveBtn.textContent = "Guardar corrección"; }
  });

  $("#edVoid", dialog)?.addEventListener("click", async () => {
    const reason = $("#edReason", dialog).value.trim();
    if (!reason) { toast("Indica el motivo de la anulación en el campo de motivo."); $("#edReason", dialog).focus(); return; }
    if (!confirm("¿Anular esta marcación? No se borra: queda marcada como anulada y deja de contar en estadísticas.")) return;
    const ok = await voidAdminRecord(id, reason);
    if (ok) { close(); renderAdminBody(); }
  });
}

async function saveAdminRecordCorrection(id, patch, reason) {
  const r = findAdminRecord(id);
  if (!r || !APP_STATE.db) { toast("No se encontró la marcación."); return false; }
  const by = emailKey(APP_STATE.activeUser);
  const previousData = { time: r.time || "", action: r.action || "", modalidad: r.modalidad || "", statusOverride: r.statusOverride || "" };
  const newData = { time: patch.time, action: patch.action, modalidad: patch.modalidad, statusOverride: patch.statusOverride };
  const history = Array.isArray(r.correctionHistory) ? r.correctionHistory.slice() : [];
  history.push({ correctedBy: by, correctedAtClient: Date.now(), previousData, newData, reason });
  try {
    await updateDoc(doc(APP_STATE.db, "teacherClassStartRecords", id), {
      ...patch,
      manualCorrection: true,
      correctionReason: reason,
      correctedBy: by,
      correctedAtClient: Date.now(),
      correctedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      correctionHistory: history
    });
    Object.assign(r, patch, { manualCorrection: true, correctionReason: reason, correctedBy: by, correctionHistory: history });
    toast("Marcación corregida.");
    return true;
  } catch (error) {
    console.error(error);
    toast(error?.code === "permission-denied"
      ? "Firebase rechazó la corrección por permisos. Verifica que ingresaste como administrador."
      : "No se pudo guardar la corrección. Revisa tu conexión.");
    return false;
  }
}

async function voidAdminRecord(id, reason) {
  const r = findAdminRecord(id);
  if (!r || !APP_STATE.db) { toast("No se encontró la marcación."); return false; }
  const by = emailKey(APP_STATE.activeUser);
  try {
    await updateDoc(doc(APP_STATE.db, "teacherClassStartRecords", id), {
      voided: true,
      voidReason: reason,
      voidedBy: by,
      voidedAtClient: Date.now(),
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    Object.assign(r, { voided: true, voidReason: reason, voidedBy: by });
    toast("Marcación anulada.");
    return true;
  } catch (error) {
    console.error(error);
    toast(error?.code === "permission-denied"
      ? "Firebase rechazó la anulación por permisos. Verifica que ingresaste como administrador."
      : "No se pudo anular la marcación. Revisa tu conexión.");
    return false;
  }
}

function pairDailyShifts(records) {
  const byKey = new Map();
  for (const r of records) {
    if (r.voided) continue; // las marcaciones anuladas no cuentan para jornadas/estadísticas
    const key = `${r.email}|${r.date}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }

  const rows = [];
  for (const [key, list] of byKey.entries()) {
    list.sort((a, b) => Number(a.createdAtClient || 0) - Number(b.createdAtClient || 0));
    const [email, date] = key.split("|");
    const name = list[0]?.name || email;
    const inicios = list.filter((r) => r.action === "inicio_clase");
    const fines = list.filter((r) => r.action === "fin_jornada");
    const firstIn = inicios[0];
    const lastOut = fines[fines.length - 1];

    let horas = "-";
    if (firstIn?.stamp && lastOut?.stamp) {
      const ms = new Date(lastOut.stamp).getTime() - new Date(firstIn.stamp).getTime();
      if (Number.isFinite(ms) && ms > 0) {
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        horas = `${h}h ${String(m).padStart(2, "0")}m`;
      }
    }

    const modalidades = Array.from(new Set(list.map((r) => getTeacherShiftModeLabel(r.modalidad)))).join(", ");
    // Ajuste manual del admin sobre una marca del día (prioriza el de ingreso).
    const statusOverride = firstIn?.statusOverride || list.find((r) => r.statusOverride)?.statusOverride || "";
    rows.push({
      date, name, email,
      entrada: firstIn?.time || "-",
      salida: lastOut?.time || (firstIn ? "Sin cierre" : "-"),
      horas,
      modalidades,
      statusOverride,
      total: list.length
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.name.localeCompare(b.name, "es");
  });
  return rows;
}

function renderAdminDiario(body) {
  const rows = pairDailyShifts(ADMIN_STATE.records);
  if (!rows.length) {
    body.innerHTML = "<p>No hay jornadas en el rango seleccionado.</p>";
    return;
  }

  const html = rows.map((r) => {
    const sinCierre = r.salida === "Sin cierre";
    const action = sinCierre
      ? `<button class="btnGhost btnSmall admCloseBtn" type="button" data-email="${escapeHtml(r.email)}" data-date="${escapeHtml(r.date)}">Registrar cierre</button>`
      : "";
    return `
    <tr class="${sinCierre ? "admRowWarn" : ""}">
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.entrada)}</td>
      <td>${escapeHtml(r.salida)}</td>
      <td>${escapeHtml(r.horas)}</td>
      <td>${escapeHtml(r.modalidades)}</td>
      <td>${escapeHtml(String(r.total))}</td>
      <td>${action}</td>
    </tr>
  `;
  }).join("");

  body.innerHTML = `
    <div class="admToolbar">
      <p class="adminMeta">${rows.length} días-docente</p>
      <button class="btnGoogle btnSmall" id="admAddShift" type="button">＋ Registrar jornada manual</button>
    </div>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Fecha</th><th>Docente</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Modalidades</th><th>Marcas</th><th></th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>
  `;

  $("#admAddShift", body)?.addEventListener("click", () => openAdminCreateShiftModal({ email: ADMIN_STATE.filters.email || "" }));
  body.querySelectorAll(".admCloseBtn").forEach((btn) => {
    btn.addEventListener("click", () => openAdminCreateShiftModal({ email: btn.dataset.email, date: btn.dataset.date, onlyClose: true }));
  });
}

/* ---- Registro manual de una jornada por parte del admin ---- */
function openAdminCreateShiftModal(prefill = {}) {
  if (!isAdminUser()) { toast("No tienes permisos para registrar jornadas."); return; }
  const onlyClose = !!prefill.onlyClose;
  const teachers = getAdminTeacherOptions().filter((t) => !ADMIN_EMAILS.includes(t.email));
  const options = teachers
    .map((t) => `<option value="${escapeHtml(t.email)}" ${prefill.email === t.email ? "selected" : ""}>${escapeHtml(t.label)}</option>`)
    .join("");
  // Si no viene un docente preseleccionado (filtro en "Todos"), forzamos elección
  // consciente para no guardar por error bajo el primer docente de la lista.
  const placeholder = (!onlyClose && !prefill.email)
    ? `<option value="" selected disabled>Selecciona docente…</option>`
    : "";
  const today = bogotaParts().date;

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>${onlyClose ? "Registrar cierre de jornada" : "Registrar jornada manual"}</h3>
      <p class="adminSubNote">El registro será creado por un administrador y quedará identificado y auditado (fuente “Registro admin”).</p>
      <label>Docente
        <select id="csEmail" ${onlyClose ? "disabled" : ""}>${placeholder}${options}</select>
      </label>
      <div class="adminOverrideGrid">
        <label>Fecha
          <input type="date" id="csDate" value="${escapeHtml(prefill.date || today)}" ${onlyClose ? "disabled" : ""} />
        </label>
        <label>Modalidad
          <select id="csMod">
            ${["sede", "hogar", "virtual", "jornada"].map((m) => `<option value="${m}">${escapeHtml(getTeacherShiftModeLabel(m))}</option>`).join("")}
          </select>
        </label>
        ${onlyClose ? "" : `<label>Hora de ingreso<input type="time" id="csIn" /></label>`}
        <label>Hora de salida<input type="time" id="csOut" /></label>
      </div>
      <label>Motivo (obligatorio)
        <input type="text" id="csReason" maxlength="200" placeholder="Ej: la docente trabajó pero su marcación no quedó guardada." />
      </label>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="csCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="csSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#csCancel", dialog)?.addEventListener("click", close);

  $("#csSave", dialog)?.addEventListener("click", async () => {
    const email = onlyClose ? prefill.email : ($("#csEmail", dialog).value || "");
    const date = onlyClose ? prefill.date : ($("#csDate", dialog).value || "");
    const modalidad = $("#csMod", dialog).value;
    const reason = $("#csReason", dialog).value.trim();
    const inTime = onlyClose ? "" : ($("#csIn", dialog)?.value || "");
    const outTime = $("#csOut", dialog)?.value || "";
    if (!email || !date) { toast("Selecciona docente y fecha."); return; }
    if (!reason) { toast("Escribe el motivo del registro."); $("#csReason", dialog).focus(); return; }
    if (!onlyClose && !inTime) { toast("Indica la hora de ingreso."); return; }
    if (!outTime && !onlyClose && !inTime) { toast("Indica al menos una hora."); return; }

    const saveBtn = $("#csSave", dialog);
    saveBtn.disabled = true; saveBtn.textContent = "Guardando…";
    const ok = await createAdminShiftRecords({ email, date, modalidad, inTime, outTime, reason });
    if (ok) {
      close();
      await loadAdminData();
    } else {
      saveBtn.disabled = false; saveBtn.textContent = "Guardar";
    }
  });
}

async function createAdminShiftRecords({ email, date, modalidad, inTime, outTime, reason }) {
  if (!APP_STATE.db) return false;
  const by = emailKey(APP_STATE.activeUser);
  const teacher = getAdminTeacherOptions().find((t) => t.email === email);
  const base = {
    role: "docente",
    email,
    name: teacher?.label || email,
    modalidad,
    source: "admin_manual",
    manualCreation: true,
    createdBy: by,
    creationReason: reason,
    createdAt: serverTimestamp(),
    createdAtClient: Date.now(),
    raw: "admin_manual"
  };
  try {
    const col = collection(APP_STATE.db, "teacherClassStartRecords");
    if (inTime) {
      await addDoc(col, { ...base, date, time: inTime, stamp: stampFromDateTime(date, inTime), action: "inicio_clase" });
    }
    if (outTime) {
      await addDoc(col, { ...base, date, time: outTime, stamp: stampFromDateTime(date, outTime), action: "fin_jornada", createdAtClient: Date.now() + 1 });
    }
    toast("Jornada registrada.");
    return true;
  } catch (error) {
    console.error(error);
    toast(error?.code === "permission-denied"
      ? "Firebase rechazó el registro por permisos. Verifica que ingresaste como administrador."
      : "No se pudo registrar la jornada. Revisa tu conexión.");
    return false;
  }
}

function renderAdminMensual(body) {
  const records = ADMIN_STATE.records;
  if (!records.length) {
    body.innerHTML = "<p>No hay datos en el rango seleccionado.</p>";
    return;
  }

  const byTeacher = new Map();
  for (const r of records) {
    const email = r.email || "-";
    if (!byTeacher.has(email)) {
      byTeacher.set(email, {
        name: r.name || email,
        email,
        ingresos: 0,
        cierres: 0,
        sede: 0,
        hogar: 0,
        virtual: 0,
        otras: 0,
        dias: new Set(),
        horasMs: 0
      });
    }
    const t = byTeacher.get(email);
    if (r.action === "inicio_clase") t.ingresos += 1;
    if (r.action === "fin_jornada") t.cierres += 1;
    const mod = String(r.modalidad || "").toLowerCase();
    if (mod === "sede") t.sede += 1;
    else if (mod === "hogar") t.hogar += 1;
    else if (mod === "virtual") t.virtual += 1;
    else t.otras += 1;
    if (r.date) t.dias.add(r.date);
  }

  for (const row of pairDailyShifts(records)) {
    const t = byTeacher.get(row.email);
    if (!t) continue;
    const match = String(row.horas).match(/(\d+)h (\d+)m/);
    if (match) {
      t.horasMs += (Number(match[1]) * 60 + Number(match[2])) * 60000;
    }
  }

  const list = Array.from(byTeacher.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));

  const rows = list.map((t) => {
    const totalH = Math.floor(t.horasMs / 3600000);
    const totalM = Math.floor((t.horasMs % 3600000) / 60000);
    const horasTotal = `${totalH}h ${String(totalM).padStart(2, "0")}m`;
    return `
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td>${t.dias.size}</td>
        <td>${t.ingresos}</td>
        <td>${t.cierres}</td>
        <td>${t.sede}</td>
        <td>${t.hogar}</td>
        <td>${t.virtual}</td>
        <td>${escapeHtml(horasTotal)}</td>
      </tr>
    `;
  }).join("");

  // --- Estadísticas de puntualidad del rango (reutiliza el motor de la pestaña Puntualidad) ---
  const stats = computeAdminStats();
  const totalHorasMs = list.reduce((acc, t) => acc + t.horasMs, 0);
  const totalH = Math.floor(totalHorasMs / 3600000);
  const totalM = Math.floor((totalHorasMs % 3600000) / 60000);
  const incompletas = pairDailyShifts(records).filter((r) => r.salida === "Sin cierre").length;

  const kpis = `
    <div class="admKpiGrid">
      ${admKpi(stats.pctPuntual + "%", "Puntualidad", stats.pctPuntual >= 80 ? "ok" : "warn")}
      ${admKpi(String(stats.tarde), `Tardanzas · prom. ${stats.avgLate ? minutesToLabel(stats.avgLate) : "0m"}`, stats.tarde ? "late" : "ok")}
      ${admKpi(String(stats.ausente), "Ausencias", stats.ausente ? "absent" : "ok")}
      ${admKpi(String(stats.salida_temprana), "Salidas antes", stats.salida_temprana ? "warn" : "ok")}
      ${admKpi(`${totalH}h ${String(totalM).padStart(2, "0")}m`, "Horas trabajadas", "info")}
      ${admKpi(String(incompletas), "Jornadas sin cierre", incompletas ? "warn" : "ok")}
      ${admKpi(minutesToLabel(stats.impacto) === "-" ? "0m" : minutesToLabel(stats.impacto), "Impacto (min)", stats.impacto ? "warn" : "ok")}
      ${admKpi(String(stats.justificado), "Justificados", "info")}
    </div>
  `;

  const best = stats.perTeacher.filter((m) => m.evaluables > 0).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const worstLate = stats.perTeacher.filter((m) => m.tarde > 0).sort((a, b) => b.tarde - a.tarde).slice(0, 5);
  const worstDays = stats.perDay.filter((d) => d.tarde + d.ausente > 0).sort((a, b) => (b.tarde + b.ausente) - (a.tarde + a.ausente)).slice(0, 5);
  const maxLate = worstLate[0]?.tarde || 1;
  const maxDay = worstDays[0] ? (worstDays[0].tarde + worstDays[0].ausente) : 1;

  body.innerHTML = `
    <div class="admToolbar">
      <p class="adminMeta">${list.length} docentes · ${escapeHtml(ADMIN_STATE.filters.from)} → ${escapeHtml(ADMIN_STATE.filters.to)}</p>
      <button class="btnGhost btnSmall" id="admCopyStats" type="button">Copiar resumen</button>
    </div>
    ${kpis}
    <div class="admRankCols">
      <section class="admCard">
        <h3 class="admCardH">🏆 Mejor puntualidad</h3>
        ${best.length ? best.map((m, i) => admRankRow(i + 1, m.name, m.pct + "%", m.pct, "ok")).join("") : `<p class="adminNote">Sin datos suficientes.</p>`}
      </section>
      <section class="admCard">
        <h3 class="admCardH">⏰ Más llegadas tarde</h3>
        ${worstLate.length ? worstLate.map((m, i) => admRankRow(i + 1, m.name, m.tarde + " tarde", Math.round((m.tarde / maxLate) * 100), "late")).join("") : `<p class="adminNote">Sin llegadas tarde. 👌</p>`}
      </section>
    </div>
    <section class="admCard">
      <h3 class="admCardH">📅 Días con más problemas</h3>
      ${worstDays.length ? worstDays.map((d) => admRankRow("", d.date, `${d.tarde} tarde · ${d.ausente} ausentes`, Math.round(((d.tarde + d.ausente) / maxDay) * 100), "warn")).join("") : `<p class="adminNote">Sin problemas en el rango. 👌</p>`}
    </section>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Docente</th><th>Días</th><th>Ingresos</th><th>Cierres</th><th>Sede</th><th>Hogar</th><th>Virtual</th><th>Horas (aprox.)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="adminNote">Horas calculadas como diferencia entre el primer ingreso y la última salida del día. La puntualidad compara la primera marca de ingreso contra el horario/override del día.</p>
  `;

  $("#admCopyStats", body)?.addEventListener("click", () => {
    const lines = [
      `Estadísticas docentes · ${ADMIN_STATE.filters.from} → ${ADMIN_STATE.filters.to}`,
      `Puntualidad: ${stats.pctPuntual}% · Tardanzas: ${stats.tarde} (prom. ${stats.avgLate ? minutesToLabel(stats.avgLate) : "0m"}) · Ausencias: ${stats.ausente}`,
      `Salidas antes: ${stats.salida_temprana} · Justificados: ${stats.justificado} · Horas trabajadas: ${totalH}h ${String(totalM).padStart(2, "0")}m · Jornadas sin cierre: ${incompletas}`,
      "",
      "Mejor puntualidad:",
      ...best.map((m, i) => `  ${i + 1}. ${m.name} — ${m.pct}%`),
      "",
      "Más llegadas tarde:",
      ...worstLate.map((m, i) => `  ${i + 1}. ${m.name} — ${m.tarde} tarde`)
    ];
    navigator.clipboard?.writeText(lines.join("\n")).then(
      () => toast("Resumen copiado."),
      () => toast("No se pudo copiar.")
    );
  });
}

/* Helpers de presentación para las estadísticas (look Admin). */
function admKpi(num, label, kind = "") {
  return `<div class="admKpi admKpi-${kind}"><span class="admKpiNum">${escapeHtml(String(num))}</span><span class="admKpiLbl">${escapeHtml(label)}</span></div>`;
}

function admRankRow(pos, name, value, pct, kind) {
  const width = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div class="admRankRow">
      <span class="admRankPos">${pos ? "#" + pos : ""}</span>
      <span class="admRankName">${escapeHtml(name)}</span>
      <span class="admRankBarWrap"><span class="admRankBar admBar-${kind}" style="width:${width}%"></span></span>
      <span class="admRankVal">${escapeHtml(value)}</span>
    </div>
  `;
}

/* Agrega puntualidad por docente y por día para el rango actual. */
function computeAdminStats() {
  const rows = buildPunctualityRows();
  const totals = { a_tiempo: 0, tarde: 0, salida_temprana: 0, ausente: 0, justificado: 0 };
  let lateSum = 0, lateN = 0, earlySum = 0;
  const perTeacher = new Map();
  const perDay = new Map();

  for (const r of rows) {
    if (totals[r.status] != null) totals[r.status] += 1;
    if (r.status === "tarde" && Number.isFinite(r.lateMin)) { lateSum += r.lateMin; lateN += 1; }
    if (r.status === "salida_temprana" && Number.isFinite(r.earlyMin)) earlySum += r.earlyMin;

    if (!perTeacher.has(r.email)) perTeacher.set(r.email, { name: r.name, a_tiempo: 0, tarde: 0, evaluables: 0 });
    const t = perTeacher.get(r.email);
    if (["a_tiempo", "tarde", "salida_temprana", "ausente"].includes(r.status)) t.evaluables += 1;
    if (r.status === "a_tiempo") t.a_tiempo += 1;
    if (r.status === "tarde") t.tarde += 1;

    if (!perDay.has(r.date)) perDay.set(r.date, { date: r.date, tarde: 0, ausente: 0 });
    const d = perDay.get(r.date);
    if (r.status === "tarde") d.tarde += 1;
    if (r.status === "ausente") d.ausente += 1;
  }

  const evaluables = totals.a_tiempo + totals.tarde + totals.salida_temprana + totals.ausente;
  return {
    ...totals,
    pctPuntual: evaluables ? Math.round((totals.a_tiempo / evaluables) * 100) : 0,
    avgLate: lateN ? Math.round(lateSum / lateN) : 0,
    impacto: lateSum + earlySum,
    perTeacher: Array.from(perTeacher.values()).map((t) => ({ ...t, pct: t.evaluables ? Math.round((t.a_tiempo / t.evaluables) * 100) : 0 })),
    perDay: Array.from(perDay.values())
  };
}

function renderAdminVivo(body) {
  const sessions = ADMIN_STATE.liveSessions.slice().sort((a, b) => {
    const ta = Number(a.openedAtClient || 0);
    const tb = Number(b.openedAtClient || 0);
    return tb - ta;
  });

  if (!sessions.length) {
    body.innerHTML = `
      <p>No hay docentes con jornada abierta en este momento.</p>
      <button class="btnGhost" type="button" id="adminReloadLive">Recargar</button>
    `;
    $("#adminReloadLive", body)?.addEventListener("click", loadAdminData);
    return;
  }

  const rows = sessions.map((s) => {
    const rec = s.openRecord || s.lastRecord || {};
    const opened = rec.time && rec.date ? `${rec.date} ${rec.time}` : (s.openedAtClient ? new Date(s.openedAtClient).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "-");
    return `
      <tr>
        <td>${escapeHtml(s.name || rec.name || s.email || "-")}</td>
        <td>${escapeHtml(s.email || "-")}</td>
        <td>${escapeHtml(opened)}</td>
        <td>${escapeHtml(getTeacherShiftModeLabel(rec.modalidad))}</td>
        <td>${escapeHtml(getTeacherShiftSourceLabel(rec.source))}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <p class="adminMeta">${sessions.length} jornadas abiertas</p>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Docente</th><th>Correo</th><th>Inicio</th><th>Modalidad</th><th>Fuente</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <button class="btnGhost" type="button" id="adminReloadLive">Recargar</button>
  `;
  $("#adminReloadLive", body)?.addEventListener("click", loadAdminData);
}

/* ---- Enumerar fechas del rango (YYYY-MM-DD) ---- */
function enumerateDates(from, to) {
  const out = [];
  if (!from || !to) return out;
  let cur = new Date(`${from}T12:00:00-05:00`);
  const end = new Date(`${to}T12:00:00-05:00`);
  let guard = 0;
  while (cur <= end && guard < 400) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

/* ---- Construye filas de evaluación de puntualidad ---- */
function buildPunctualityRows() {
  const { email: filterEmail, from, to } = ADMIN_STATE.filters;

  // Mapa de marcas por día/docente.
  const recRows = pairDailyShifts(ADMIN_STATE.records);
  const recMap = new Map();
  for (const r of recRows) recMap.set(`${r.email}|${r.date}`, r);

  // Universo de docentes a evaluar.
  let teachers = getAdminTeacherOptions().filter((t) => !ADMIN_EMAILS.includes(t.email));
  if (filterEmail) teachers = teachers.filter((t) => t.email === filterEmail);

  const dates = enumerateDates(from, to);
  const rows = [];
  const validTime = (t) => /^\d{1,2}:\d{2}$/.test(String(t || ""));

  for (const t of teachers) {
    for (const date of dates) {
      const rec = recMap.get(`${t.email}|${date}`);
      const expected = getExpectedSchedule(t.email, date);
      if (!expected && !rec) continue; // nada que mostrar

      const firstIn = rec && validTime(rec.entrada) ? rec.entrada : "";
      const lastOut = rec && validTime(rec.salida) ? rec.salida : "";
      let evalResult = evaluatePunctuality(t.email, date, firstIn, lastOut);

      // Ajuste manual del admin sobre la marcación (pestaña Marcaciones → Editar).
      const so = rec?.statusOverride;
      if (so === "puntual" && (evalResult.status === "tarde" || evalResult.status === "salida_temprana")) {
        evalResult = { ...evalResult, status: "a_tiempo", label: "Puntual (ajuste admin)", lateMin: null, earlyMin: null, adminAdjusted: true };
      } else if (so === "justificado" && evalResult.status !== "sin_horario" && evalResult.status !== "a_tiempo") {
        evalResult = { ...evalResult, status: "justificado", label: "Justificado (ajuste admin)", adminAdjusted: true };
      }

      rows.push({
        email: t.email,
        name: t.label,
        date,
        firstIn: firstIn || "-",
        lastOut: lastOut || (rec ? "Sin cierre" : "-"),
        expectedStart: expected?.start || "-",
        expectedEnd: expected?.end || "-",
        note: expected?.note || "",
        source: expected?.source || "",
        ...evalResult
      });
    }
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.name.localeCompare(b.name, "es");
  });
  return rows;
}

function renderAdminPuntualidad(body) {
  const rows = buildPunctualityRows();

  if (!rows.length) {
    body.innerHTML = `
      <p>No hay datos de puntualidad en el rango. Configura horarios en la pestaña <strong>Horarios</strong> o verifica que existan marcaciones.</p>
    `;
    return;
  }

  // KPIs
  const counts = { a_tiempo: 0, tarde: 0, salida_temprana: 0, ausente: 0, justificado: 0, sin_horario: 0 };
  let lateSum = 0, lateN = 0;
  for (const r of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    if (r.status === "tarde" && Number.isFinite(r.lateMin)) { lateSum += r.lateMin; lateN += 1; }
  }
  const evaluables = counts.a_tiempo + counts.tarde + counts.salida_temprana + counts.ausente;
  const pctPuntual = evaluables ? Math.round((counts.a_tiempo / evaluables) * 100) : 0;
  const avgLate = lateN ? Math.round(lateSum / lateN) : 0;

  const kpis = `
    <div class="adminKpis">
      <div class="kpiCard kpiOk"><span class="kpiNum">${pctPuntual}%</span><span class="kpiLbl">Puntualidad</span></div>
      <div class="kpiCard kpiLate"><span class="kpiNum">${counts.tarde}</span><span class="kpiLbl">Tardanzas</span></div>
      <div class="kpiCard kpiAbsent"><span class="kpiNum">${counts.ausente}</span><span class="kpiLbl">Ausencias</span></div>
      <div class="kpiCard kpiEarly"><span class="kpiNum">${counts.salida_temprana}</span><span class="kpiLbl">Salidas antes</span></div>
      <div class="kpiCard kpiAvg"><span class="kpiNum">${avgLate ? minutesToLabel(avgLate) : "0m"}</span><span class="kpiLbl">Tarde promedio</span></div>
    </div>
  `;

  const html = rows.map((r) => {
    const badge = PUNCTUALITY_BADGE[r.status] || "none";
    const noteHtml = r.note ? `<span class="puntNote" title="${escapeHtml(r.note)}">📝</span>` : "";
    return `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.expectedStart)}${r.expectedEnd !== "-" ? " → " + escapeHtml(r.expectedEnd) : ""}</td>
        <td>${escapeHtml(r.firstIn)}</td>
        <td><span class="puntBadge punt-${badge}">${escapeHtml(r.label)}</span> ${noteHtml}</td>
        <td><button class="btnGhost puntAdjust" type="button" data-email="${escapeHtml(r.email)}" data-date="${escapeHtml(r.date)}">Ajustar</button></td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    ${kpis}
    <p class="adminMeta">${rows.length} días evaluados · ${escapeHtml(ADMIN_STATE.filters.from)} → ${escapeHtml(ADMIN_STATE.filters.to)}</p>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Fecha</th><th>Docente</th><th>Esperado</th><th>Entrada real</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>
    <p class="adminNote">El estado compara la primera marca de ingreso contra la hora esperada (override del día si existe, si no el horario semanal del docente fijo). Gracia configurable por docente.</p>
  `;

  body.querySelectorAll(".puntAdjust").forEach((btn) => {
    btn.addEventListener("click", () => openOverrideEditor(btn.dataset.email, btn.dataset.date));
  });
}

/* ---- Editor de ajuste de un día (override) ---- */
function openScheduleOverrideDialog(email, date, name, expected, ov) {
  const hasOverride = !!ov;
  const works = ov ? (ov.enabled !== false && ov.works !== false && !ov.dayOff) : !expected?.dayOff;
  const start = ov?.start || expected?.start || "";
  const end = ov?.end || expected?.end || "";
  const modalidad = ov?.modalidad || ov?.modality || expected?.modalidad || "jornada";
  const grace = Number.isFinite(Number(ov?.graceMinutes)) ? Number(ov.graceMinutes) : getGraceMinutes(email);
  const note = ov?.note || ov?.reason || expected?.note || "";
  const weekday = weekdayKeyFromDate(date);

  const weekdayOptions = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"].map((wd) => `
    <label class="dayCheck">
      <input type="checkbox" class="ovWeekday" value="${wd}" ${wd === weekday ? "checked" : ""} />
      <span>${escapeHtml(PUNCTUALITY.WEEKDAY_LABELS[wd].slice(0, 3))}</span>
    </label>
  `).join("");

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard adminScheduleOverrideCard" role="dialog" aria-modal="true">
      <h3>Excepcion de horario · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">Asigna dias puntuales, cambia horarios o marca si la docente no viene.</p>
      <div class="adminOverrideGrid">
        <label>Desde
          <input type="date" id="ovFrom" value="${escapeHtml(date)}" />
        </label>
        <label>Hasta
          <input type="date" id="ovTo" value="${escapeHtml(date)}" />
        </label>
      </div>
      <div class="weekdayPick">${weekdayOptions}</div>
      <label class="adminCheck">
        <input type="checkbox" id="ovWorks" ${works ? "checked" : ""} />
        <span>Viene / tiene jornada esos dias</span>
      </label>
      <div class="adminOverrideGrid" id="ovWorkFields">
        <label>Entrada
          <input type="time" id="ovStartNew" value="${escapeHtml(start)}" />
        </label>
        <label>Salida
          <input type="time" id="ovEndNew" value="${escapeHtml(end)}" />
        </label>
        <label>Modalidad
          <select id="ovMode">
            ${["jornada", "sede", "hogar", "virtual"].map((m) => `<option value="${m}" ${modalidad === m ? "selected" : ""}>${escapeHtml(getTeacherShiftModeLabel(m))}</option>`).join("")}
          </select>
        </label>
        <label>Gracia (min)
          <input type="number" id="ovGrace" min="0" max="120" value="${escapeHtml(String(grace))}" />
        </label>
      </div>
      <label>Comentario / motivo
        <input type="text" id="ovNoteNew" maxlength="180" value="${escapeHtml(note)}" placeholder="Ej: permiso, reposicion, cambio de horario, evento" />
      </label>
      <label class="adminCheck">
        <input type="checkbox" id="ovExcusedNew" ${expected?.excused || ov?.excused ? "checked" : ""} />
        <span>Justificado para puntualidad</span>
      </label>
      <div class="adminSubActions">
        ${hasOverride ? `<button class="btnGhost adminDanger" id="ovDeleteNew" type="button">Quitar excepcion</button>` : "<span></span>"}
        <div>
          <button class="btnGhost" id="ovCancelNew" type="button">Cancelar</button>
          <button class="btnGoogle" id="ovSaveNew" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  const syncFields = () => {
    const enabled = $("#ovWorks", dialog)?.checked;
    $("#ovWorkFields", dialog)?.querySelectorAll("input, select").forEach((el) => { el.disabled = !enabled; });
  };
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#ovCancelNew", dialog)?.addEventListener("click", close);
  $("#ovWorks", dialog)?.addEventListener("change", syncFields);
  syncFields();

  $("#ovSaveNew", dialog)?.addEventListener("click", async () => {
    const from = $("#ovFrom", dialog).value || date;
    const to = $("#ovTo", dialog).value || from;
    const selectedDays = new Set(Array.from(dialog.querySelectorAll(".ovWeekday:checked")).map((el) => el.value));
    const dates = enumerateDates(from, to).filter((itemDate) => selectedDays.has(weekdayKeyFromDate(itemDate)));
    if (!dates.length) {
      toast("Selecciona al menos una fecha y un dia de semana.");
      return;
    }
    const enabled = $("#ovWorks", dialog).checked;
    const noteText = $("#ovNoteNew", dialog).value.trim();
    const data = {
      enabled,
      works: enabled,
      start: enabled ? ($("#ovStartNew", dialog).value || "") : "",
      end: enabled ? ($("#ovEndNew", dialog).value || "") : "",
      modalidad: enabled ? ($("#ovMode", dialog).value || "jornada") : "",
      graceMinutes: Number($("#ovGrace", dialog).value) || 0,
      excused: !enabled || $("#ovExcusedNew", dialog).checked,
      note: noteText,
      reason: noteText,
      rangeStart: from,
      rangeEnd: to,
      weekdays: Array.from(selectedDays)
    };
    try {
      for (const itemDate of dates) {
        await saveScheduleOverride(email, itemDate, data);
        ADMIN_STATE.overrides[overrideId(email, itemDate)] = { id: overrideId(email, itemDate), email, date: itemDate, ...data };
      }
      toast(`${dates.length} excepcion${dates.length === 1 ? "" : "es"} guardada${dates.length === 1 ? "" : "s"}.`);
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar la excepcion. Revisa permisos/reglas.");
    }
  });

  $("#ovDeleteNew", dialog)?.addEventListener("click", async () => {
    try {
      await deleteScheduleOverride(email, date);
      delete ADMIN_STATE.overrides[overrideId(email, date)];
      toast("Excepcion eliminada.");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo eliminar la excepcion.");
    }
  });
}

function openOverrideEditor(email, date) {
  const teacher = getAdminTeacherOptions().find((t) => t.email === email);
  const name = teacher?.label || email;
  const expected = getExpectedSchedule(email, date);
  const ov = ADMIN_STATE.overrides[overrideId(email, date)];

  openScheduleOverrideDialog(email, date, name, expected, ov);
  return;

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Ajustar día · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">${escapeHtml(date)}</p>
      <label>Hora esperada de entrada
        <input type="time" id="ovStart" value="${escapeHtml(expected?.start || "")}" />
      </label>
      <label>Hora esperada de salida (opcional)
        <input type="time" id="ovEnd" value="${escapeHtml(expected?.end || "")}" />
      </label>
      <label class="adminCheck">
        <input type="checkbox" id="ovExcused" ${expected?.excused ? "checked" : ""} />
        <span>Justificado (no cuenta como tardanza/ausencia)</span>
      </label>
      <label>Nota
        <input type="text" id="ovNote" maxlength="140" value="${escapeHtml(expected?.note || "")}" placeholder="Ej: cambio de horario por evento" />
      </label>
      <div class="adminSubActions">
        ${ov ? `<button class="btnGhost adminDanger" id="ovDelete" type="button">Quitar ajuste</button>` : "<span></span>"}
        <div>
          <button class="btnGhost" id="ovCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="ovSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  $("#ovCancel", dialog)?.addEventListener("click", close);

  $("#ovSave", dialog)?.addEventListener("click", async () => {
    const data = {
      start: $("#ovStart", dialog).value || "",
      end: $("#ovEnd", dialog).value || "",
      excused: $("#ovExcused", dialog).checked,
      note: $("#ovNote", dialog).value.trim()
    };
    try {
      await saveScheduleOverride(email, date, data);
      ADMIN_STATE.overrides[overrideId(email, date)] = { id: overrideId(email, date), email, date, ...data };
      toast("Ajuste guardado ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar el ajuste. Revisa permisos/reglas.");
    }
  });

  $("#ovDelete", dialog)?.addEventListener("click", async () => {
    try {
      await deleteScheduleOverride(email, date);
      delete ADMIN_STATE.overrides[overrideId(email, date)];
      toast("Ajuste eliminado.");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo eliminar el ajuste.");
    }
  });
}

/* ---- Pestaña Académica: estadísticas de tareas / bolsa de horas ---- */
function renderAdminAcademica(body) {
  const data = ADMIN_STATE.academic || { objectives: [], budgets: [], hourLogs: [] };
  const filterEmail = ADMIN_STATE.filters.email;

  const byEmail = (arr) => filterEmail ? arr.filter((x) => x.teacherEmail === filterEmail) : arr;
  const objectives = byEmail(data.objectives);
  const budgets = byEmail(data.budgets);
  const hourLogs = byEmail(data.hourLogs);

  if (!objectives.length && !budgets.length && !hourLogs.length) {
    body.innerHTML = `<p>No hay datos de la Bitácora Académica todavía${filterEmail ? " para esa docente" : ""}. Aparecerán aquí cuando las docentes registren tareas y horas.</p>`;
    return;
  }

  // Agrupar por docente.
  const map = new Map();
  const ensure = (email, name) => {
    if (!map.has(email)) {
      map.set(email, {
        email,
        name: name || email,
        bolsa: 0, usado: 0, planeado: 0,
        tareas: 0, completadas: 0, enCurso: 0, pendientes: 0
      });
    }
    const row = map.get(email);
    if (name && (!row.name || row.name === email)) row.name = name;
    return row;
  };

  for (const b of budgets) {
    const r = ensure(b.teacherEmail, b.teacherName);
    r.bolsa += academicNum(b.hours);
  }
  for (const log of hourLogs) {
    const r = ensure(log.teacherEmail, log.teacherName);
    r.usado += academicNum(log.recognizedHours || log.durationHours);
  }
  for (const o of objectives) {
    const r = ensure(o.teacherEmail, o.teacherName);
    r.planeado += academicNum(o.estimatedHours);
    r.tareas += 1;
    const st = academicStateLabel(o.state);
    if (st === "Cumplido") r.completadas += 1;
    else if (st === "En curso") r.enCurso += 1;
    else r.pendientes += 1;
  }

  const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));

  // KPIs globales.
  const totals = rows.reduce((acc, r) => {
    acc.bolsa += r.bolsa; acc.usado += r.usado; acc.planeado += r.planeado;
    acc.tareas += r.tareas; acc.completadas += r.completadas; acc.pendientes += r.pendientes + r.enCurso;
    return acc;
  }, { bolsa: 0, usado: 0, planeado: 0, tareas: 0, completadas: 0, pendientes: 0 });
  const pctEjec = totals.tareas ? Math.round((totals.completadas / totals.tareas) * 100) : 0;

  const kpis = `
    <div class="adminKpis">
      <div class="kpiCard kpiAvg"><span class="kpiNum">${rows.length}</span><span class="kpiLbl">Docentes activas</span></div>
      <div class="kpiCard"><span class="kpiNum">${totals.tareas}</span><span class="kpiLbl">Tareas totales</span></div>
      <div class="kpiCard kpiOk"><span class="kpiNum">${pctEjec}%</span><span class="kpiLbl">Ejecución</span></div>
      <div class="kpiCard kpiLate"><span class="kpiNum">${academicHours(totals.usado)}</span><span class="kpiLbl">Horas usadas</span></div>
      <div class="kpiCard kpiEarly"><span class="kpiNum">${academicHours(totals.bolsa)}</span><span class="kpiLbl">Bolsa asignada</span></div>
    </div>
  `;

  const tableRows = rows.map((r) => {
    const restante = r.bolsa - r.usado;
    const over = r.bolsa > 0 && r.usado > r.bolsa;
    const pct = r.tareas ? Math.round((r.completadas / r.tareas) * 100) : 0;
    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${academicHours(r.bolsa)}</td>
        <td>${academicHours(r.planeado)}</td>
        <td>${academicHours(r.usado)}</td>
        <td><span class="${over ? "danger-text" : ""}">${academicHours(restante)}</span></td>
        <td>${r.tareas}</td>
        <td>${r.completadas}</td>
        <td>${r.enCurso}</td>
        <td>${r.pendientes}</td>
        <td>${pct}%</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    ${kpis}
    <p class="adminMeta">${rows.length} docente(s) con actividad en la Bitácora Académica</p>
    <div class="recordTableWrap">
      <table class="recordTable">
        <thead><tr>
          <th>Docente</th><th>Bolsa</th><th>Planeado</th><th>Usado</th><th>Restante</th>
          <th>Tareas</th><th>Cumplidas</th><th>En curso</th><th>Pendientes</th><th>% Ejec.</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <p class="adminNote">Datos del módulo Bitácora Académica (Firestore). “Restante” = bolsa asignada − horas usadas. Usa el filtro de docente para ver una sola.</p>
  `;
}

/* ---- Pestaña Docentes: gestionar acceso al HUB desde el front ---- */
async function fetchHubUsers() {
  const map = {};
  try {
    const snap = await getDocs(collection(APP_STATE.db, "hubUsers"));
    snap.forEach((d) => { map[d.id] = { email: d.id, ...(d.data() || {}) }; });
  } catch (err) {
    console.warn("No se pudieron leer hubUsers (¿reglas sin publicar?)", err);
    ADMIN_STATE.hubUsersError = err?.message || "sin permiso";
    return {};
  }
  ADMIN_STATE.hubUsersError = "";
  try {
    await syncTeacherDirectory(map);
  } catch (error) {
    console.warn("No se pudo sincronizar teacherDirectory. Publica las reglas nuevas.", error);
  }
  return map;
}

async function syncTeacherDirectory(managed = {}) {
  if (!isAdminUser(APP_STATE.activeUser)) return;
  const emails = new Set([...Object.keys(HUB.USERS || {}), ...Object.keys(managed || {})]);
  await Promise.all(Array.from(emails).map(async (email) => {
    const base = HUB.USERS?.[email] || {};
    const data = managed?.[email] || {};
    const enabled = ADMIN_EMAILS.includes(email)
      || (data.enabled !== false && !isAccessExpired(data.accessExpiresAt));
    await setDoc(doc(APP_STATE.db, "teacherDirectory", email), {
      email,
      name: data.label || data.name || base.label || email,
      enabled,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }));
}

// Acceso temporal: convierte una opción de duración en una fecha de corte (epoch ms).
// "indefinido" => null (sin vencimiento). Las demás vencen al final del día objetivo.
const ACCESS_DURATIONS = [
  { key: "indefinido", label: "Indefinido", days: null },
  { key: "1d", label: "1 día", days: 1 },
  { key: "1w", label: "1 semana", days: 7 },
  { key: "1m", label: "1 mes", days: 30 }
];

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function computeAccessExpiry(durationKey) {
  const opt = ACCESS_DURATIONS.find((d) => d.key === durationKey);
  if (!opt || opt.days == null) return null;
  const d = startOfLocalDay();
  d.setDate(d.getDate() + opt.days);
  return endOfLocalDay(d).getTime();
}

// Verdadero si el doc gestionado tiene vencimiento ya pasado.
function isAccessExpired(accessExpiresAt) {
  return typeof accessExpiresAt === "number" && accessExpiresAt > 0 && Date.now() > accessExpiresAt;
}

// Texto amable para mostrar el estado de vencimiento en la tabla.
function describeAccessExpiry(accessExpiresAt) {
  if (!(typeof accessExpiresAt === "number" && accessExpiresAt > 0)) return "";
  const fecha = new Date(accessExpiresAt);
  const fechaTxt = fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  if (Date.now() > accessExpiresAt) return `venció el ${fechaTxt}`;
  const todayStart = startOfLocalDay();
  const expiryStart = startOfLocalDay(fecha);
  const calendarDays = Math.round((expiryStart.getTime() - todayStart.getTime()) / 86400000);
  if (calendarDays <= 0) return `vence hoy (${fechaTxt})`;
  if (calendarDays === 1) return `vence mañana (${fechaTxt})`;
  return `vence en ${calendarDays} días (${fechaTxt})`;
}

async function saveHubUser(email, data) {
  email = String(email || "").toLowerCase().trim();
  const ref = doc(APP_STATE.db, "hubUsers", email);
  await setDoc(ref, {
    email,
    ...data,
    updatedBy: emailKey(APP_STATE.activeUser),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Verificación inmediata: si esto falla, el panel lo dice ahí mismo y no queda
  // esa ilusión tan humana de “guardó” cuando Firebase estaba diciendo “pues no”.
  const check = await getDoc(ref);
  if (!check.exists()) throw new Error("No se pudo verificar el docente guardado en Firestore.");
  const saved = check.data() || {};
  await setDoc(doc(APP_STATE.db, "teacherDirectory", email), {
    email,
    name: saved.label || saved.name || email,
    enabled: saved.enabled !== false && !isAccessExpired(saved.accessExpiresAt),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { email, ...(check.data() || {}) };
}

async function deleteHubUser(email) {
  await deleteDoc(doc(APP_STATE.db, "hubUsers", email));
  await deleteDoc(doc(APP_STATE.db, "teacherDirectory", email));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

// Lista combinada: usuarios base (código) + gestionados (Firestore).
function buildDocenteRows() {
  const managed = ADMIN_STATE.hubUsers || {};
  const emails = new Set([
    ...Object.keys(HUB.USERS || {}),
    ...Object.keys(managed)
  ]);

  const rows = [];
  for (const email of emails) {
    const base = HUB.USERS?.[email] || null;
    const md = managed[email] || null;
    const isAdmin = ADMIN_EMAILS.includes(email);
    // Estado efectivo: gestionado manda; si no, base => activo.
    const enabled = md ? md.enabled !== false : true;
    rows.push({
      email,
      name: md?.label || md?.name || base?.label || email,
      isAdmin,
      inBase: !!base,
      managed: !!md,
      enabled: isAdmin ? true : enabled,
      accessExpiresAt: (typeof md?.accessExpiresAt === "number" && md.accessExpiresAt > 0) ? md.accessExpiresAt : null,
      areas: Array.isArray(md?.areas) ? md.areas : [],
      especialidades: Array.isArray(md?.especialidades) ? md.especialidades : [],
      employmentType: md?.employmentType === "support_contractor" ? "support_contractor" : "staff",
      visibleButtons: getVisibleButtonsForUserDoc(md)
    });
  }
  rows.sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });
  return rows;
}

function renderAdminDocentes(body) {
  const rows = buildDocenteRows();
  const errorNote = ADMIN_STATE.hubUsersError
    ? `<p class="adminNote" style="color:#ce0039">⚠️ No se pudo leer la lista gestionada (${escapeHtml(ADMIN_STATE.hubUsersError)}). Publica las reglas de Firestore para activar la gestión de docentes.</p>`
    : "";

  const tableRows = rows.map((r) => {
    const expired = !r.isAdmin && r.enabled && isAccessExpired(r.accessExpiresAt);
    const expiryTxt = r.accessExpiresAt ? describeAccessExpiry(r.accessExpiresAt) : "";
    let estado;
    if (r.isAdmin) {
      estado = `<span class="puntBadge punt-excused">Admin</span>`;
    } else if (!r.enabled) {
      estado = `<span class="puntBadge punt-absent">Inhabilitado</span>`;
    } else if (expired) {
      estado = `<span class="puntBadge punt-absent">Vencido</span><br><span class="adminNote">${escapeHtml(expiryTxt)}</span>`;
    } else if (r.accessExpiresAt) {
      estado = `<span class="puntBadge punt-ok">Temporal</span><br><span class="adminNote">${escapeHtml(expiryTxt)}</span>`;
    } else {
      estado = `<span class="puntBadge punt-ok">Activo</span>`;
    }
    const origen = r.inBase ? "Código" : "Panel";

    const supportProfile = ADMIN_STATE.supportProfiles?.[r.email] || {};
    const supportAcceptance = ADMIN_STATE.supportAcceptances?.[supportAcceptanceId(r.email)] || null;
    const supportState = r.employmentType === "support_contractor" ? supportStatus(supportProfile, supportAcceptance) : "not_applicable";
    const supportDate = supportAcceptance?.acceptedAt?.toDate?.();
    const supportCell = `<span class="puntBadge ${supportState === "accepted" ? "punt-ok" : supportState === "not_applicable" ? "punt-none" : "punt-excused"}">${r.employmentType === "support_contractor" ? "Docente de apoyo" : "Docente de planta"}</span><br><span class="adminNote">${escapeHtml(supportContractStatusLabel(supportState))}${supportAcceptance ? ` · v${escapeHtml(supportAcceptance.contractVersion || "")}${supportDate ? ` · ${escapeHtml(supportDate.toLocaleDateString("es-CO"))}` : ""}` : ""}</span>`;
    const areasLabel = r.isAdmin
      ? `<span class="adminNote">Todas (admin)</span>`
      : (r.areas.length
        ? `${r.areas.map((a) => `<span class="puntBadge punt-excused">${escapeHtml(a)}</span>`).join(" ")}${r.especialidades.length ? ` <span class="adminNote">+${r.especialidades.length} esp.</span>` : ""}`
        : `<span class="adminNote">Sin asignar</span>`);

    let actions = "";
    if (r.isAdmin) {
      actions = `<span class="adminNote">—</span>`;
    } else {
      const toggleLabel = r.enabled ? "Inhabilitar" : "Habilitar";
      let btns = `<button class="btnGhost docMini docEdit" type="button" data-email="${escapeHtml(r.email)}">Editar</button>`;
      if (r.employmentType === "support_contractor") btns += `<button class="btnGhost docMini docSupport" type="button" data-email="${escapeHtml(r.email)}">Vinculación</button>`;
      btns += `<button class="btnGhost docMini docAreas" type="button" data-email="${escapeHtml(r.email)}">Áreas</button>`;
      btns += `<button class="btnGhost docMini docButtons" type="button" data-email="${escapeHtml(r.email)}">Botones</button>`;
      btns += `<button class="btnGhost docMini docAccess" type="button" data-email="${escapeHtml(r.email)}">Acceso</button>`;
      btns += `<button class="btnGhost docMini docToggle" type="button" data-email="${escapeHtml(r.email)}" data-enable="${r.enabled ? "0" : "1"}">${toggleLabel}</button>`;
      // "Quitar" solo para los creados en el panel (no base de código).
      if (r.managed && !r.inBase) {
        btns += `<button class="btnGhost docMini adminDanger docRemove" type="button" data-email="${escapeHtml(r.email)}">Quitar</button>`;
      }
      actions = `<div class="docActions">${btns}</div>`;
    }

    return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td><span class="mono">${escapeHtml(r.email)}</span></td>
        <td>${estado}</td>
        <td>${supportCell}</td>
        <td class="docAreasCell">${areasLabel}</td>
        <td>${origen}</td>
        <td class="docActionsCell">${actions}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <div class="docAddCard">
      <div class="docAddHead"><div><h3>Agregar docente</h3>
      <p class="adminNote">Con esto le das acceso al HUB sin tocar el código. El correo debe ser el de su cuenta de Google.</p>
      </div><button class="btnGhost docPreviewSupport" id="docPreviewSupport" type="button">Vista previa · Docente de apoyo</button></div>
      <div class="docAddForm">
        <input type="text" id="docNewName" placeholder="Nombre (ej: Laura Sánchez)" />
        <input type="email" id="docNewEmail" placeholder="correo@gmail.com" />
        <select id="docNewAccess" title="Duración del acceso">
          ${ACCESS_DURATIONS.map((d) => `<option value="${d.key}">${escapeHtml(d.label)}</option>`).join("")}
        </select>
        <button class="btnGoogle" id="docAddBtn" type="button">Agregar y habilitar</button>
      </div>
      <p class="adminNote" style="margin-top:6px">Para docentes de reemplazo, elige <strong>1 día / 1 semana / 1 mes</strong>: el acceso queda activo hasta las 11:59 p. m. de la fecha indicada y se bloquea solo después de vencer. <strong>Indefinido</strong> es para docentes de planta.</p>
    </div>
    ${errorNote}
    <p class="adminMeta">${rows.length} docente(s) · base de código + gestionados</p>
    <div class="recordTableWrap">
      <table class="recordTable docTable">
        <colgroup>
          <col class="colDocente" /><col class="colCorreo" /><col class="colEstado" /><col class="colVinculacion" />
          <col class="colAreas" /><col class="colOrigen" /><col class="colAcciones" />
        </colgroup>
        <thead><tr><th>Docente</th><th>Correo</th><th>Estado</th><th>Vinculación</th><th>Áreas</th><th>Origen</th><th>Acciones</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <p class="adminNote">“Activo” / “Temporal” pueden iniciar sesión y usar el HUB. “Temporal” muestra la fecha calendario de vencimiento; por ejemplo, si dice “vence mañana”, puede entrar durante todo ese día y se bloquea después de las 11:59 p. m. “Inhabilitado” queda bloqueado de inmediato. Con “Acceso” cambias la duración (indefinido / 1 día / 1 semana / 1 mes); con “Áreas” defines qué ve cada quien en la Biblioteca. Los docentes de “Código” no se pueden borrar, pero sí inhabilitar.</p>
  `;

  $("#docAddBtn", body)?.addEventListener("click", async () => {
    const name = $("#docNewName", body).value.trim();
    const email = $("#docNewEmail", body).value.trim().toLowerCase();
    const accessKey = $("#docNewAccess", body)?.value || "indefinido";
    if (!isValidEmail(email)) { toast("Correo inválido 🙃"); return; }
    try {
      const accessExpiresAt = computeAccessExpiry(accessKey);
      const saved = await saveHubUser(email, { label: name || email, role: "docente", enabled: true, accessExpiresAt });
      ADMIN_STATE.hubUsers[email] = { email, label: saved.label || name || email, role: saved.role || "docente", enabled: saved.enabled !== false, accessExpiresAt };
      refreshAdminTeacherFilterOptions();
      toast(accessExpiresAt ? "Docente agregada · acceso temporal ✅" : "Docente agregada y habilitada ✅");
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo agregar. Revisa permisos/reglas.");
    }
  });

  body.querySelectorAll(".docToggle").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      const enable = btn.dataset.enable === "1";
      const base = HUB.USERS?.[email] || null;
      const label = ADMIN_STATE.hubUsers[email]?.label || base?.label || email;
      try {
        const saved = await saveHubUser(email, { label, role: "docente", enabled: enable });
        ADMIN_STATE.hubUsers[email] = { ...(ADMIN_STATE.hubUsers[email] || {}), ...saved, email, label: saved.label || label, enabled: saved.enabled !== false };
        refreshAdminTeacherFilterOptions();
        toast(enable ? "Docente habilitada ✅" : "Docente inhabilitada");
        renderAdminBody();
      } catch (err) {
        console.error(err);
        toast("No se pudo actualizar. Revisa permisos/reglas.");
      }
    });
  });

  body.querySelectorAll(".docEdit").forEach((btn) => {
    btn.addEventListener("click", () => openDocenteEditor(btn.dataset.email));
  });

  $("#docPreviewSupport", body)?.addEventListener("click", openSupportContractPreview);

  body.querySelectorAll(".docSupport").forEach((btn) => {
    btn.addEventListener("click", () => openAdminSupportDetail(btn.dataset.email));
  });

  body.querySelectorAll(".docAreas").forEach((btn) => {
    btn.addEventListener("click", () => openDocenteAreasEditor(btn.dataset.email));
  });

  body.querySelectorAll(".docButtons").forEach((btn) => {
    btn.addEventListener("click", () => openDocenteButtonsEditor(btn.dataset.email));
  });

  body.querySelectorAll(".docAccess").forEach((btn) => {
    btn.addEventListener("click", () => openDocenteAccessEditor(btn.dataset.email));
  });

  body.querySelectorAll(".docRemove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      if (!confirm(`¿Quitar acceso a ${email}? Podrás volver a agregarla cuando quieras.`)) return;
      try {
        await deleteHubUser(email);
        delete ADMIN_STATE.hubUsers[email];
        refreshAdminTeacherFilterOptions();
        toast("Docente quitada.");
        renderAdminBody();
      } catch (err) {
        console.error(err);
        toast("No se pudo quitar. Revisa permisos/reglas.");
      }
    });
  });
}

/* ---- Editor de datos básicos (nombre y correo) ---- */
function openDocenteEditor(email) {
  const md = ADMIN_STATE.hubUsers?.[email] || {};
  const base = HUB.USERS?.[email] || null;
  const name = md.label || md.name || base?.label || "";
  const employmentType = md.employmentType === "support_contractor" ? "support_contractor" : "staff";
  // El correo de los docentes de "Código" está fijo en la base del código: solo se
  // puede cambiar el nombre; el correo se edita únicamente en docentes gestionados.
  const inBase = !!base;

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Editar docente</h3>
      <p class="adminSubSub">Corrige el nombre o el correo de acceso. El correo debe ser el de su cuenta de Google.</p>
      <div class="docAddForm">
        <div>
          <span class="docEditField">Nombre</span>
          <input type="text" id="docEditName" placeholder="Nombre" value="${escapeHtml(name)}" />
        </div>
        <div>
          <span class="docEditField">Correo de acceso</span>
          <input type="email" id="docEditEmail" placeholder="correo@gmail.com" value="${escapeHtml(email)}" ${inBase ? "disabled" : ""} />
        </div>
        <div>
          <span class="docEditField">Tipo de vinculación</span>
          <select id="docEmploymentType"><option value="staff" ${employmentType === "staff" ? "selected" : ""}>Docente de planta</option><option value="support_contractor" ${employmentType === "support_contractor" ? "selected" : ""}>Docente de apoyo</option></select>
        </div>
      </div>
      ${inBase
        ? `<p class="adminNote" style="margin-top:8px">Esta docente viene de la base de código: su correo no se puede cambiar desde el panel.</p>`
        : `<p class="adminNote" style="margin-top:8px">Si cambias el correo, se migran sus áreas, botones y vigencia de acceso al correo nuevo, y el anterior deja de tener acceso.</p>`}
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="docEditCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="docEditSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#docEditCancel", dialog)?.addEventListener("click", close);

  $("#docEditSave", dialog)?.addEventListener("click", async () => {
    const newName = $("#docEditName", dialog).value.trim();
    const newEmail = inBase ? email : $("#docEditEmail", dialog).value.trim().toLowerCase();
    if (!isValidEmail(newEmail)) { toast("Correo inválido 🙃"); return; }
    if (newEmail !== email && (ADMIN_STATE.hubUsers?.[newEmail] || HUB.USERS?.[newEmail])) {
      toast("Ese correo ya está registrado.");
      return;
    }

    const payload = {
      label: newName || newEmail,
      role: md.role || "docente",
      enabled: md.enabled !== false,
      employmentType: $("#docEmploymentType", dialog)?.value || "staff"
    };
    if (typeof md.accessExpiresAt === "number" && md.accessExpiresAt > 0) payload.accessExpiresAt = md.accessExpiresAt;
    if (Array.isArray(md.areas)) payload.areas = md.areas;
    if (Array.isArray(md.especialidades)) payload.especialidades = md.especialidades;
    if (Array.isArray(md.visibleButtons)) payload.visibleButtons = md.visibleButtons;

    try {
      const saved = await saveHubUser(newEmail, payload);
      if (newEmail !== email) {
        await deleteHubUser(email);
        delete ADMIN_STATE.hubUsers[email];
      }
      ADMIN_STATE.hubUsers[newEmail] = { ...(ADMIN_STATE.hubUsers[newEmail] || {}), ...saved, email: newEmail };
      refreshAdminTeacherFilterOptions();
      toast(newEmail !== email ? "Docente actualizada · correo cambiado ✅" : "Docente actualizada ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar. Revisa permisos/reglas.");
    }
  });
}

/* ---- Editor de áreas para la Biblioteca de Recursos ---- */
function openDocenteButtonsEditor(email) {
  const md = ADMIN_STATE.hubUsers?.[email] || {};
  const base = HUB.USERS?.[email] || null;
  const name = md.label || base?.label || email;
  const assignable = getAssignableButtons();
  const current = getVisibleButtonsForUserDoc(md) || assignable.map((button) => button.id);
  const currentSet = new Set(current);
  const sections = groupBySection(assignable);
  const groups = Array.from(sections.entries()).map(([section, buttons]) => `
    <div class="buttonAssignGroup">
      <h4>${escapeHtml(section)}</h4>
      ${buttons.map((button) => `
        <label class="adminCheck buttonAssignItem">
          <input type="checkbox" data-button-id="${escapeHtml(button.id)}" ${currentSet.has(button.id) ? "checked" : ""} />
          <span><strong>${escapeHtml(button.title)}</strong><small>${escapeHtml(button.subtitle || "")}</small></span>
        </label>
      `).join("")}
    </div>
  `).join("");

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard adminSubCardWide" role="dialog" aria-modal="true">
      <h3>Botones · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">Elige los accesos que vera esta docente en su HUB. Si marcas todos, conserva la vista completa.</p>
      <div class="buttonAssignToolbar">
        <button class="btnGhost" id="buttonsSelectAll" type="button">Marcar todos</button>
        <button class="btnGhost" id="buttonsClear" type="button">Limpiar</button>
      </div>
      <div class="buttonAssignGrid">${groups}</div>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="buttonsCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="buttonsSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  const checks = () => $$("input[data-button-id]", dialog);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#buttonsCancel", dialog)?.addEventListener("click", close);
  $("#buttonsSelectAll", dialog)?.addEventListener("click", () => checks().forEach((input) => { input.checked = true; }));
  $("#buttonsClear", dialog)?.addEventListener("click", () => checks().forEach((input) => { input.checked = false; }));
  $("#buttonsSave", dialog)?.addEventListener("click", async () => {
    const visibleButtons = checks().filter((input) => input.checked).map((input) => input.dataset.buttonId);
    try {
      const saved = await saveHubUser(email, {
        label: name,
        role: "docente",
        enabled: md.enabled !== false,
        visibleButtons
      });
      ADMIN_STATE.hubUsers[email] = { ...(ADMIN_STATE.hubUsers[email] || {}), ...saved, email };
      toast("Botones guardados ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudieron guardar los botones. Revisa permisos/reglas.");
    }
  });
}

async function openDocenteAreasEditor(email) {
  const md = ADMIN_STATE.hubUsers?.[email] || {};
  const base = HUB.USERS?.[email] || null;
  const name = md.label || base?.label || email;
  const currentAreas = Array.isArray(md.areas) ? md.areas : [];
  const currentEsp = (Array.isArray(md.especialidades) ? md.especialidades : []).map(normalizeText);

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Áreas · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">Define qué ve esta docente en la Biblioteca de Recursos. Si marcas especialidades dentro de un área, verá solo esas; si dejas el área sin especialidades, la verá completa.</p>
      <p class="adminNote" style="margin:0 0 6px"><strong>Áreas</strong></p>
      <div class="areasMacroGrid">
        ${BIBLIOTECA_MACRO_AREAS.map((a) => `
          <label class="adminCheck areaCheck">
            <input type="checkbox" data-macro="${escapeHtml(a)}" ${currentAreas.includes(a) ? "checked" : ""} />
            <span>${escapeHtml(a)}</span>
          </label>
        `).join("")}
      </div>
      <p class="adminNote" style="margin:10px 0 6px"><strong>Especialidades</strong> (opcional)</p>
      <div class="areasEspGrid" id="areasEspGrid"><span class="adminNote">Cargando especialidades de la biblioteca…</span></div>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="areasCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="areasSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  $("#areasCancel", dialog)?.addEventListener("click", close);

  // Especialidades disponibles según el catálogo real de la biblioteca.
  try {
    const lista = await fetchBibliotecaAreasConfig();
    const grid = $("#areasEspGrid", dialog);
    if (grid) {
      grid.innerHTML = lista.length
        ? lista.map((a) => `
            <label class="adminCheck areaCheck">
              <input type="checkbox" data-esp="${escapeHtml(a)}" ${currentEsp.includes(normalizeText(a)) ? "checked" : ""} />
              <span>${escapeHtml(a)}</span>
            </label>
          `).join("")
        : `<span class="adminNote">No se pudo cargar el catálogo de la biblioteca. Puedes asignar solo áreas macro.</span>`;
    }
  } catch (_) { /* el grid queda con el mensaje de carga/fallo */ }

  $("#areasSave", dialog)?.addEventListener("click", async () => {
    const areas = $$("input[data-macro]", dialog).filter((i) => i.checked).map((i) => i.dataset.macro);
    const especialidades = $$("input[data-esp]", dialog).filter((i) => i.checked).map((i) => i.dataset.esp);
    try {
      const saved = await saveHubUser(email, { label: name, areas, especialidades, enabled: md.enabled !== false });
      ADMIN_STATE.hubUsers[email] = { ...(ADMIN_STATE.hubUsers[email] || {}), ...saved, email };
      toast("Áreas guardadas ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudieron guardar las áreas. Revisa permisos/reglas.");
    }
  });
}

/* ---- Editor de acceso temporal (vencimiento) ---- */
async function openDocenteAccessEditor(email) {
  const md = ADMIN_STATE.hubUsers?.[email] || {};
  const base = HUB.USERS?.[email] || null;
  const name = md.label || base?.label || email;
  const current = (typeof md.accessExpiresAt === "number" && md.accessExpiresAt > 0) ? md.accessExpiresAt : null;
  const estadoActual = current ? describeAccessExpiry(current) : "acceso indefinido";

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Acceso · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">Estado actual: <strong>${escapeHtml(estadoActual)}</strong>. Elige cuánto tiempo más tendrá acceso al HUB. Al vencer, queda bloqueada automáticamente.</p>
      <div class="areasMacroGrid">
        ${ACCESS_DURATIONS.map((d, i) => `
          <label class="adminCheck areaCheck">
            <input type="radio" name="accessDur" value="${d.key}" ${i === 0 ? "checked" : ""} />
            <span>${escapeHtml(d.label)}</span>
          </label>
        `).join("")}
      </div>
      <p class="adminNote" style="margin-top:8px">El conteo es por fecha calendario y el acceso queda activo hasta las 11:59 p. m. de la fecha mostrada. Ej.: “1 día” = vence mañana; “1 semana” = vence en 7 días.</p>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="accessCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="accessSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  $("#accessCancel", dialog)?.addEventListener("click", close);

  $("#accessSave", dialog)?.addEventListener("click", async () => {
    const key = ($$("input[name='accessDur']", dialog).find((i) => i.checked) || {}).value || "indefinido";
    const accessExpiresAt = computeAccessExpiry(key);
    try {
      const saved = await saveHubUser(email, {
        label: name,
        role: "docente",
        enabled: md.enabled !== false,
        accessExpiresAt
      });
      ADMIN_STATE.hubUsers[email] = { ...(ADMIN_STATE.hubUsers[email] || {}), ...saved, email, accessExpiresAt };
      refreshAdminTeacherFilterOptions();
      toast(accessExpiresAt ? "Acceso temporal actualizado ✅" : "Acceso indefinido ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo actualizar el acceso. Revisa permisos/reglas.");
    }
  });
}

/* ---- Pestaña Horarios: configurar tipo + gracia + semana ---- */
function renderScheduleWeekPreview(weekly = {}) {
  const html = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
    .map((wd) => {
      const day = weekly[wd] || {};
      return day.start
        ? `<span><strong>${escapeHtml(PUNCTUALITY.WEEKDAY_LABELS[wd].slice(0, 3))}</strong> ${escapeHtml(scheduleRangeText(day.start, day.end))}</span>`
        : "";
    })
    .filter(Boolean)
    .join("");
  return html || "<span>Sin dias configurados</span>";
}

function openScheduleExceptionPicker(email) {
  const teacher = getAdminTeacherOptions().find((t) => t.email === email);
  const name = teacher?.label || email;
  const { date: today } = bogotaParts();
  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Excepcion de horario · ${escapeHtml(name)}</h3>
      <p class="adminSubSub">Elige el dia puntual que quieres cambiar. Si ya existe una excepcion para esa fecha, podras editarla o quitarla.</p>
      <label>Fecha
        <input type="date" id="schedExceptionDate" value="${escapeHtml(today)}" />
      </label>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="schedExceptionCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="schedExceptionOpen" type="button">Continuar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (event) => { if (event.target === dialog) close(); });
  $("#schedExceptionCancel", dialog)?.addEventListener("click", close);
  $("#schedExceptionOpen", dialog)?.addEventListener("click", async () => {
    const date = $("#schedExceptionDate", dialog)?.value || today;
    close();
    await loadSingleScheduleOverride(email, date);
    openOverrideEditor(email, date);
  });
}

async function loadSingleScheduleOverride(email, date) {
  if (!APP_STATE.db || !email || !date) return;
  try {
    const snap = await getDoc(doc(APP_STATE.db, "teacherScheduleOverrides", overrideId(email, date)));
    if (snap.exists()) {
      ADMIN_STATE.overrides[overrideId(email, date)] = { id: snap.id, ...(snap.data() || {}) };
    } else {
      delete ADMIN_STATE.overrides[overrideId(email, date)];
    }
  } catch (error) {
    console.warn("No se pudo cargar la excepcion del horario", error);
  }
}

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Renderiza un único mes (grande y legible). `getItem(date)` devuelve el horario
// esperado para esa fecha o null. `todayStr` resalta el día actual.
function renderScheduleMonthSolo(getItem, year, monthIndex, todayStr = "", options = {}) {
  const monthName = MONTH_NAMES_ES[monthIndex] || "";
  const clickable = !!options.clickable;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const leading = Math.max(0, PUNCTUALITY.WEEKDAYS.indexOf(weekdayKeyFromDate(firstDate)));
  const blanks = Array.from({ length: leading }, () => `<div class="scheduleDay isBlank"></div>`).join("");
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const item = getItem(date);
    let chip = "";
    if (item) {
      const baseLabel = item.excused ? "Justificado" : `${item.start || ""}${item.end ? `–${item.end}` : ""}`;
      const label = item.lunch ? `${baseLabel} 🍴` : baseLabel;
      const title = item.lunch ? `${item.note || baseLabel} · incluye 1h de almuerzo` : (item.note || baseLabel);
      chip = `<span class="scheduleChip ${item.source === "override" ? "isOverride" : ""}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
    }
    const isToday = date === todayStr ? "isToday" : "";
    return `
      <div class="scheduleDay ${chip ? "hasSchedule" : ""} ${isToday}">
        <strong>${dayNum}</strong>
        <div>${chip}</div>
      </div>
    `;
  }).join("");
  return `
    <section class="scheduleMonth scheduleMonthSolo">
      <h4>${escapeHtml(monthName)} ${escapeHtml(year)}</h4>
      <div class="scheduleWeekdays"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
      <div class="scheduleMonthGrid">${blanks}${days}</div>
    </section>
  `;
}

// Día + mes corto (ej. "6 jul") para etiquetar semanas.
function shortDayMonth(dateStr) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" })
    .format(new Date(`${dateStr}T12:00:00-05:00`))
    .replace(".", "");
}

// Minutos netos de una jornada aplicando la regla de almuerzo: si la jornada
// bruta supera 6 horas, se descuenta 1 hora de almuerzo.
function netShiftMinutes(startMin, endMin) {
  if (startMin == null || endMin == null || endMin <= startMin) {
    return { gross: 0, net: 0, lunch: false };
  }
  const gross = endMin - startMin;
  const lunch = gross > 360; // más de 6 horas
  return { gross, net: lunch ? gross - 60 : gross, lunch };
}

// Suma, semana a semana (lun–dom) del mes visible, las horas AGENDADAS del
// horario fijo (y sus excepciones), aplicando la regla de almuerzo. Sirve para
// confirmar que las horas semanales quedaron bien programadas de antemano.
function computeScheduleWeeks(email, year, monthIndex) {
  const { from, to } = scheduleMonthWeekRange(year, monthIndex);
  const weeks = [];
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 8) {
    const weekStart = cursor;
    const sunday = addDaysToDateStr(weekStart, 6);
    let net = 0, lunchDays = 0, hasDays = false;
    for (let i = 0; i < 7; i++) {
      const date = addDaysToDateStr(weekStart, i);
      const item = getExpectedSchedule(email, date);
      if (!item || item.dayOff || item.excused) continue;
      const s = timeToMinutes(item.start), e = timeToMinutes(item.end);
      const { net: dayNet, lunch } = netShiftMinutes(s, e);
      if (dayNet <= 0) continue;
      net += dayNet;
      if (lunch) lunchDays += 1;
      hasDays = true;
    }
    weeks.push({ weekStart, sunday, net, lunchDays, hasDays });
    cursor = addDaysToDateStr(weekStart, 7);
    guard += 1;
  }
  return weeks;
}

function renderScheduleWeeksPanel(email) {
  const weeks = computeScheduleWeeks(email, ADMIN_STATE.scheduleYear, ADMIN_STATE.scheduleMonth)
    .filter((w) => w.hasDays);
  if (!weeks.length) {
    return `<p class="adminNote">Sin días agendados en las semanas de este mes.</p>`;
  }
  const rows = weeks.map((w) => {
    const lunchNote = w.lunchDays
      ? ` · <span class="schedWeekJust">🍴 ${w.lunchDays} día${w.lunchDays === 1 ? "" : "s"} con almuerzo (−${w.lunchDays}h)</span>`
      : "";
    return `
      <div class="schedWeekRow">
        <div class="schedWeekWhen">
          <strong>${escapeHtml(shortDayMonth(w.weekStart))} – ${escapeHtml(shortDayMonth(w.sunday))}</strong>
          <small>Horas agendadas${lunchNote}</small>
        </div>
        <span class="admComp admComp-total">${escapeHtml(minutesToLabel(w.net))}</span>
      </div>
    `;
  }).join("");
  return `
    <div class="schedWeeksPanel">
      <h4>Horas agendadas por semana (lun–dom)</h4>
      ${rows}
      <p class="adminNote">Suma las horas del horario fijo (y excepciones) de cada semana para confirmar que quedaron bien programadas. Si un día supera 6 horas, se descuenta 1 hora de almuerzo.</p>
    </div>
  `;
}

function renderAdminAnnualScheduleCalendar(teachers, year) {
  const fixedTeachers = teachers.filter((t) => (ADMIN_STATE.schedules[t.email]?.type || "flexible") === "fijo");
  const monthIndex = ADMIN_STATE.scheduleMonth;

  const monthNav = `
    <div class="scheduleMonthNav">
      <button class="btnGhost scheduleMonthStep" type="button" data-step="-1" aria-label="Mes anterior">‹</button>
      <strong class="scheduleMonthLabel">${escapeHtml(MONTH_NAMES_ES[monthIndex])} ${escapeHtml(year)}</strong>
      <button class="btnGhost scheduleMonthStep" type="button" data-step="1" aria-label="Mes siguiente">›</button>
      <button class="btnGhost scheduleMonthToday" type="button">Hoy</button>
    </div>
  `;

  if (!fixedTeachers.length) {
    return `
      <div class="scheduleYearPanel">
        <div class="scheduleYearHead">
          <div>
            <h3>Horario por docente</h3>
            <p class="adminNote">Aun no hay docentes con horario fijo configurado.</p>
          </div>
        </div>
      </div>
    `;
  }

  // Selecciona un docente (el guardado en estado o el primero fijo).
  let selected = fixedTeachers.find((t) => t.email === ADMIN_STATE.scheduleTeacher);
  if (!selected) {
    selected = fixedTeachers[0];
    ADMIN_STATE.scheduleTeacher = selected.email;
  }

  const teacherOptions = fixedTeachers
    .map((t) => `<option value="${escapeHtml(t.email)}" ${t.email === selected.email ? "selected" : ""}>${escapeHtml(t.label)}</option>`)
    .join("");

  const { date: todayStr } = bogotaParts();
  const month = renderScheduleMonthSolo((date) => scheduleCalendarDisplayItem(getExpectedSchedule(selected.email, date)), year, monthIndex, todayStr, { clickable: true });
  return `
    <div class="scheduleYearPanel">
      <div class="scheduleYearHead">
        <div>
          <h3>Horario por docente</h3>
          <p class="adminNote">Las excepciones (en color) reemplazan el horario semanal de ese día.</p>
        </div>
      </div>
      <label class="scheduleTeacherPicker">
        <span>Docente</span>
        <select id="scheduleTeacherSelect">${teacherOptions}</select>
      </label>
      ${monthNav}
      <div class="scheduleSoloWrap">${month}</div>
      ${renderScheduleWeeksPanel(selected.email)}
    </div>
  `;
}

function renderAdminHorarios(body) {
  const teachers = getAdminTeacherOptions().filter((t) => !ADMIN_EMAILS.includes(t.email));
  if (!teachers.length) {
    body.innerHTML = "<p>No hay docentes configurados.</p>";
    return;
  }

  const cards = teachers.map((t) => {
    const sched = ADMIN_STATE.schedules[t.email] || {};
    const type = sched.type || "flexible";
    const grace = Number.isFinite(Number(sched.graceMinutes)) ? Number(sched.graceMinutes) : PUNCTUALITY.DEFAULT_GRACE;
    const weeklyPreview = renderScheduleWeekPreview(sched.weekly || {});
    const summary = type === "fijo"
      ? "Jornada fija (horario semanal)"
      : "Flexible (se ajusta por día)";
    return `
      <div class="schedCard">
        <div class="schedCardHead">
          <div>
            <strong>${escapeHtml(t.label)}</strong>
            <span class="schedType schedType-${type}">${type === "fijo" ? "Fijo" : "Flexible"}</span>
          </div>
          <div class="schedActions">
            <button class="btnGhost schedEdit" type="button" data-email="${escapeHtml(t.email)}">Configurar semana</button>
            <button class="btnGhost schedException" type="button" data-email="${escapeHtml(t.email)}">Excepcion por dia</button>
          </div>
        </div>
        <p class="schedSummary">${summary} · gracia ${grace} min</p>
        ${type === "fijo"
          ? `<div class="schedWeekPreview">${weeklyPreview}</div>`
          : `<p class="adminNote">No aparece el boton Horario para esta docente. Puedes crear excepciones puntuales si lo necesitas.</p>`}
      </div>
    `;
  }).join("");

  const annualCalendar = renderAdminAnnualScheduleCalendar(teachers, ADMIN_STATE.scheduleYear);

  body.innerHTML = `
    <p class="adminMeta">Aqui configuras el horario semanal y las excepciones por fecha. Las docentes con horario <strong>fijo</strong> veran el boton Horario en su HUB; las <strong>flexibles</strong> no lo veran.</p>
    ${annualCalendar}
    <div class="schedGrid">${cards}</div>
  `;

  body.querySelectorAll(".scheduleMonthStep").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.step) || 0;
      let m = ADMIN_STATE.scheduleMonth + step;
      let y = ADMIN_STATE.scheduleYear;
      if (m < 0) { m = 11; y -= 1; }
      else if (m > 11) { m = 0; y += 1; }
      ADMIN_STATE.scheduleMonth = m;
      if (y !== ADMIN_STATE.scheduleYear) {
        ADMIN_STATE.scheduleYear = y;
        loadAdminData(); // recarga excepciones del nuevo año
      } else {
        renderAdminBody();
      }
    });
  });
  $(".scheduleMonthToday", body)?.addEventListener("click", () => {
    const now = new Date();
    const y = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(now));
    ADMIN_STATE.scheduleMonth = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", month: "numeric" }).format(now)) - 1;
    if (y !== ADMIN_STATE.scheduleYear) {
      ADMIN_STATE.scheduleYear = y;
      loadAdminData();
    } else {
      renderAdminBody();
    }
  });
  $("#scheduleTeacherSelect", body)?.addEventListener("change", (e) => {
    ADMIN_STATE.scheduleTeacher = e.target.value || "";
    renderAdminBody();
  });

  body.querySelectorAll(".scheduleSoloWrap .scheduleDay:not(.isBlank)").forEach((dayEl) => {
    const dayNum = Number(dayEl.querySelector("strong")?.textContent || "");
    const email = ADMIN_STATE.scheduleTeacher;
    if (!dayNum || !email) return;
    const date = `${ADMIN_STATE.scheduleYear}-${String(ADMIN_STATE.scheduleMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    dayEl.classList.add("isClickable");
    dayEl.setAttribute("role", "button");
    dayEl.setAttribute("tabindex", "0");
    dayEl.setAttribute("title", `Editar ${date}`);
    const open = () => openOverrideEditor(email, date);
    dayEl.addEventListener("click", open);
    dayEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });

  body.querySelectorAll(".schedEdit").forEach((btn) => {
    btn.addEventListener("click", () => openScheduleEditor(btn.dataset.email));
  });
  body.querySelectorAll(".schedException").forEach((btn) => {
    btn.addEventListener("click", () => openScheduleExceptionPicker(btn.dataset.email));
  });
}

function openScheduleEditor(email) {
  const teacher = getAdminTeacherOptions().find((t) => t.email === email);
  const name = teacher?.label || email;
  const sched = ADMIN_STATE.schedules[email] || {};
  const type = sched.type || "flexible";
  const grace = Number.isFinite(Number(sched.graceMinutes)) ? Number(sched.graceMinutes) : PUNCTUALITY.DEFAULT_GRACE;
  const weekly = sched.weekly || {};

  const weekdayRows = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"].map((wd) => {
    const day = weekly[wd] || {};
    return `
      <div class="schedDayRow">
        <span class="schedDayLbl">${escapeHtml(PUNCTUALITY.WEEKDAY_LABELS[wd])}</span>
        <input type="time" data-wd="${wd}" data-field="start" value="${escapeHtml(day.start || "")}" />
        <span>→</span>
        <input type="time" data-wd="${wd}" data-field="end" value="${escapeHtml(day.end || "")}" />
      </div>
    `;
  }).join("");

  const dialog = document.createElement("div");
  dialog.className = "adminSubModal";
  dialog.innerHTML = `
    <div class="adminSubCard" role="dialog" aria-modal="true">
      <h3>Horario · ${escapeHtml(name)}</h3>
      <label>Tipo de docente
        <select id="schedType">
          <option value="flexible" ${type === "flexible" ? "selected" : ""}>Flexible (ajuste por día)</option>
          <option value="fijo" ${type === "fijo" ? "selected" : ""}>Fijo (horario semanal)</option>
        </select>
      </label>
      <label>Minutos de gracia
        <input type="number" id="schedGrace" min="0" max="60" value="${grace}" />
      </label>
      <div id="schedWeekly" class="schedWeekly" ${type === "fijo" ? "" : "hidden"}>
        <p class="schedWeeklyHint">Horario semanal (deja vacío un día si no trabaja).</p>
        ${weekdayRows}
      </div>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="schedCancel" type="button">Cancelar</button>
          <button class="btnGoogle" id="schedSave" type="button">Guardar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const close = () => dialog.remove();
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  $("#schedCancel", dialog)?.addEventListener("click", close);

  $("#schedType", dialog)?.addEventListener("change", (e) => {
    const wk = $("#schedWeekly", dialog);
    if (wk) wk.hidden = e.target.value !== "fijo";
  });

  $("#schedSave", dialog)?.addEventListener("click", async () => {
    const newType = $("#schedType", dialog).value;
    const newGrace = Number($("#schedGrace", dialog).value) || 0;
    const newWeekly = {};
    dialog.querySelectorAll("[data-wd]").forEach((input) => {
      const wd = input.dataset.wd;
      const field = input.dataset.field;
      if (!newWeekly[wd]) newWeekly[wd] = {};
      newWeekly[wd][field] = input.value || "";
    });
    // Limpia días sin start.
    Object.keys(newWeekly).forEach((wd) => {
      if (!newWeekly[wd].start) delete newWeekly[wd];
    });

    const data = { type: newType, graceMinutes: newGrace, weekly: newWeekly };
    try {
      await saveTeacherSchedule(email, data);
      ADMIN_STATE.schedules[email] = { email, ...data };
      toast("Horario guardado ✅");
      close();
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar el horario. Revisa permisos/reglas.");
    }
  });
}

/* ----------------------------------------------------------------------------
   PESTAÑA ADMIN: BOTONES PERSONALIZADOS
---------------------------------------------------------------------------- */
function renderAdminBotones(body) {
  const list = ADMIN_STATE.customButtons || [];
  const sections = Array.from(new Set((HUB.BUTTONS || []).map((b) => b.section).filter(Boolean)));
  const sectionOptions = sections.map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");

  const rows = list.length
    ? list.map((b) => `
        <div class="customBtnRow">
          <span class="customBtnIcon">${escapeHtml(b.icon || "🔗")}</span>
          <div class="customBtnInfo">
            <strong>${escapeHtml(b.title || "")}</strong>
            <small>${escapeHtml(b.section || "")}${b.subtitle ? ` · ${escapeHtml(b.subtitle)}` : ""}</small>
            <a href="${escapeHtml(String(b.url || ""))}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(b.url || ""))}</a>
          </div>
          <div class="customBtnActions">
            <button class="btnGhost customBtnEdit" type="button" data-id="${escapeHtml(b.id)}">Editar</button>
            <button class="btnGhost customBtnDelete" type="button" data-id="${escapeHtml(b.id)}">Borrar</button>
          </div>
        </div>
      `).join("")
    : `<p class="adminNote">Aún no hay botones personalizados. Crea el primero abajo.</p>`;

  body.innerHTML = `
    <p class="adminMeta">Crea accesos nuevos con su enlace. Aparecen en el catálogo y los asignas a cada docente desde la pestaña <strong>Docentes</strong>. Los enlaces se abren en el navegador del sistema.</p>
    <div class="customBtnList">${rows}</div>
    <div class="customBtnForm">
      <h3 id="customBtnFormTitle">Nuevo botón</h3>
      <input type="hidden" id="cbId" value="" />
      <div class="customBtnFields">
        <label>Icono (emoji)<input type="text" id="cbIcon" maxlength="4" placeholder="🔗" /></label>
        <label>Título<input type="text" id="cbTitle" maxlength="60" placeholder="Ej: Cursos Vacacionales" /></label>
        <label>Subtítulo<input type="text" id="cbSubtitle" maxlength="60" placeholder="Ej: Inscripciones" /></label>
        <label>Sección<input type="text" id="cbSection" list="cbSectionList" placeholder="Ej: Institucional" />
          <datalist id="cbSectionList">${sectionOptions}</datalist>
        </label>
        <label class="customBtnFull">URL<input type="url" id="cbUrl" placeholder="https://..." /></label>
      </div>
      <div class="adminSubActions">
        <span></span>
        <div>
          <button class="btnGhost" id="cbReset" type="button">Limpiar</button>
          <button class="btnGoogle" id="cbSave" type="button">Guardar botón</button>
        </div>
      </div>
    </div>
  `;

  const emojiGroups = [
    ["Generales", ["🔗", "⭐", "✨", "🎯", "📌", "📍", "🔔", "✅", "📝", "💡", "🚀", "🌟", "🏆", "🥇"]],
    ["Documentos y organización", ["📚", "📖", "🗂️", "📁", "📄", "🧾", "📅", "⏰", "🕒", "📊", "📈", "🔍"]],
    ["Docencia y música", ["🎓", "👩‍🏫", "👨‍🏫", "🧑‍🏫", "🏫", "🎼", "🎵", "🎶", "🎤", "🎸", "🎹", "🎻", "🥁", "🎭", "🎨", "💃", "🩰"]],
    ["Comunicación y tecnología", ["💬", "📣", "📩", "📧", "📞", "📱", "💻", "🖥️", "🌐", "🔒", "🔑", "⚙️", "🛠️", "🧰"]],
    ["Personas y actividades", ["🤝", "👥", "🧑‍🤝‍🧑", "❤️", "🌱", "☀️", "🌈", "🏠", "🚗", "🚌", "✈️", "🧳", "🍎", "🎒", "👶", "🧒"]]
  ];
  const iconInput = $("#cbIcon", body);
  const setIconValue = (value = "") => {
    const iconPicker = $("#cbIcon", body);
    if (!iconPicker) return;
    if (value && !Array.from(iconPicker.options).some((option) => option.value === value)) {
      const option = new Option(value, value);
      iconPicker.add(option, 1);
    }
    iconPicker.value = value;
  };

  if (iconInput) {
    const iconPicker = document.createElement("select");
    iconPicker.id = "cbIcon";
    iconPicker.setAttribute("aria-label", "Icono del botón");
    iconPicker.innerHTML = `<option value="">Escoge un emoji</option>${emojiGroups.map(([label, emojis]) =>
      `<optgroup label="${label}">${emojis.map((emoji) => `<option value="${emoji}">${emoji}</option>`).join("")}</optgroup>`
    ).join("")}`;
    iconInput.replaceWith(iconPicker);
  }

  const resetForm = () => {
    $("#cbId", body).value = "";
    $("#cbIcon", body).value = "";
    $("#cbTitle", body).value = "";
    $("#cbSubtitle", body).value = "";
    $("#cbSection", body).value = "";
    $("#cbUrl", body).value = "";
    $("#customBtnFormTitle", body).textContent = "Nuevo botón";
  };

  $("#cbReset", body)?.addEventListener("click", resetForm);

  body.querySelectorAll(".customBtnEdit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const b = list.find((x) => x.id === btn.dataset.id);
      if (!b) return;
      $("#cbId", body).value = b.id;
      setIconValue(b.icon || "");
      $("#cbTitle", body).value = b.title || "";
      $("#cbSubtitle", body).value = b.subtitle || "";
      $("#cbSection", body).value = b.section || "";
      $("#cbUrl", body).value = b.url || "";
      $("#customBtnFormTitle", body).textContent = "Editar botón";
      $("#customBtnFormTitle", body).scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  body.querySelectorAll(".customBtnDelete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const b = list.find((x) => x.id === btn.dataset.id);
      if (!b) return;
      if (!confirm(`¿Borrar el botón "${b.title}"? Dejará de verse en el HUB de los docentes.`)) return;
      try {
        await deleteCustomButton(b.id);
        ADMIN_STATE.customButtons = list.filter((x) => x.id !== b.id);
        applyCustomButtons(ADMIN_STATE.customButtons);
        toast("Botón borrado 🗑️");
        renderAdminBody();
      } catch (err) {
        console.error(err);
        toast("No se pudo borrar. Revisa permisos/reglas.");
      }
    });
  });

  $("#cbSave", body)?.addEventListener("click", async () => {
    const title = $("#cbTitle", body).value.trim();
    const url = normalizeUrl($("#cbUrl", body).value.trim());
    if (!title) { toast("Ponle un título al botón ✍️"); return; }
    if (!url) { toast("La URL no es válida 🔗"); return; }
    const existingId = $("#cbId", body).value.trim();
    const id = existingId || slugifyButtonId(title);
    const button = {
      id,
      icon: $("#cbIcon", body).value.trim() || "🔗",
      title,
      subtitle: $("#cbSubtitle", body).value.trim(),
      section: $("#cbSection", body).value.trim() || "Recursos",
      url,
      order: list.length
    };
    try {
      const saved = await saveCustomButton(button);
      const without = (ADMIN_STATE.customButtons || []).filter((x) => x.id !== id);
      ADMIN_STATE.customButtons = [...without, saved];
      applyCustomButtons(ADMIN_STATE.customButtons);
      toast(existingId ? "Botón actualizado ✅" : "Botón creado ✅");
      renderAdminBody();
    } catch (err) {
      console.error(err);
      toast("No se pudo guardar el botón. Revisa permisos/reglas.");
    }
  });
}

/* ============================================================================
   12) RENDER BOTONES
============================================================================ */
function groupBySection(buttons = []) {
  const map = new Map();

  for (const button of buttons) {
    const section = button.section || "Accesos";
    if (!map.has(section)) {
      map.set(section, []);
    }
    map.get(section).push(button);
  }

  return map;
}

function isAdminUser(user = APP_STATE.activeUser) {
  return ADMIN_EMAILS.includes(emailKey(user));
}

function getResolvedButtonState(button, links = {}) {
  const isSpecial =
    button?.id === "disponibilidad" ||
    button?.id === "carnet" ||
    button?.id === "jornada" ||
    button?.id === "horarioAnual" ||
    button?.id === "adminPanel" ||
    button?.id === "bitacoraAcademica" ||
    button?.id === "academicModule" ||
    button?.id === "studentMessages" ||
    button?.id === "bibliotecaRecursos" ||
    button?.id === "supportContract";
  if (button?.adminOnly && !isAdminUser()) {
    return { isSpecial: false, url: "", available: false, visible: false };
  }
  if (button?.supportOnly && APP_STATE.hubUserDoc?.employmentType !== "support_contractor") {
    return { isSpecial: false, url: "", available: false, visible: false };
  }
  const assignedButtons = getVisibleButtonsForUserDoc(APP_STATE.hubUserDoc);
  if (assignedButtons && !button?.adminOnly && !["studentMessages", "supportContract", "disponibilidad"].includes(button?.id) && !assignedButtons.includes(button?.id)) {
    return { isSpecial: false, url: "", available: false, visible: false };
  }
  if (button?.id === "horarioAnual") {
    const schedule = APP_STATE.teacherSchedule?.schedule;
    const visible = schedule?.type === "fijo" && !!schedule?.weekly;
    return { isSpecial: true, url: "__SPECIAL__", available: visible, visible };
  }
  // Módulos internos disponibles para cualquier usuario con acceso al HUB.
  if (button?.id === "bitacoraAcademica" || button?.id === "academicModule" || button?.id === "studentMessages" || button?.id === "bibliotecaRecursos" || button?.id === "supportContract") {
    return { isSpecial: true, url: "__SPECIAL__", available: true, visible: true };
  }
  const url = isSpecial ? "__SPECIAL__" : String(links?.[button?.id] || "").trim();
  const available = isSpecial || !!url;
  const visible = isSpecial || available || !!button?.showWhenMissing;

  return {
    isSpecial,
    url,
    available,
    visible
  };
}

function renderButtons(buttons = [], links = {}, profile = null) {
  const grid = $("#grid");
  if (!grid) return;

  APP_STATE.activeLinks = links || {};
  APP_STATE.activeProfile = profile || null;

  // El acceso de estudiantes se retiró: Bitácoras de clase es el único acceso
  // oficial para el registro pedagógico.
  const hiddenHomeButtons = new Set(["salones", "bitacoraClasesNueva"]);
  const filteredButtons = buttons.filter((button) => {
    if (hiddenHomeButtons.has(button?.id)) return false;
    const state = getResolvedButtonState(button, APP_STATE.activeLinks);
    return state.visible;
  });
  const heroActions = [
    { id: "jornada", className: "heroPrimary", label: "Registrar entrada  ⇥" }
  ]
    .filter((action) => {
      if (hiddenHomeButtons.has(action.id)) return false;
      const button = getButtonMeta(action.id);
      return button && getResolvedButtonState(button, APP_STATE.activeLinks).visible;
    })
    .map((action) => `<button class="${action.className}" type="button" data-id="${action.id}">${escapeHtml(action.label)}</button>`)
    .join("");
  const scheduleNudge = renderTeacherScheduleNudge();

  const sections = groupBySection(filteredButtons);
  const teacherName = (profile?.label || prettyName(APP_STATE.activeUser) || "Docente").trim();
  const firstName = teacherName.split(/\s+/)[0] || "Docente";
  const avatarInitial = (firstName.charAt(0) || "M").toUpperCase();
  const avatarPhoto = String(APP_STATE.activeUser?.photoURL || "").trim();
  let html = `
    <section class="hubHero" aria-label="Inicio de hoy">
      <div class="heroGreeting">
        <button class="heroAvatar" type="button" data-sup="perfil" aria-label="Ver mi perfil">${avatarPhoto ? `<img src="${escapeHtml(avatarPhoto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()" />` : ""}<span class="avatarInitial" aria-hidden="true">${escapeHtml(avatarInitial)}</span></button>
        <div class="heroCopy">
          <h1>Hola, ${escapeHtml(firstName)}</h1>
          <span>Docente Musicala</span>
        </div>
        <div class="heroIcons">
          <button class="heroIconBtn" type="button" data-sup="ayuda" aria-label="Cómo funciona la app" title="Ayuda">?</button>
          <button class="heroIconBtn" type="button" data-id="carnet" aria-label="Ver carnet" title="Carnet">🪪</button>
        </div>
      </div>

      <article class="heroShiftCard heroPetite">
        <p>☀️ Jornada de hoy</p>
        <h2>Registro de jornada</h2>
        ${scheduleNudge}
        ${heroActions ? `<div class="heroShiftActions">${heroActions}</div>` : ""}
      </article>
    </section>

    <div id="slot-nextclass" class="slotWrap" data-tab-scope="inicio" style="grid-column: 1 / -1;">${renderNextClassCardHTML()}</div>
    <div id="slot-pending" class="slotWrap" data-tab-scope="inicio" style="grid-column: 1 / -1;">${renderPendingBannerHTML()}</div>
    <div id="slot-kpis" class="slotWrap" data-tab-scope="inicio" style="grid-column: 1 / -1;">${renderKpiRowHTML()}</div>
    <div id="slot-soporte" class="slotWrap" data-tab-scope="soporte" style="grid-column: 1 / -1;">${renderSoportePanelHTML()}</div>
    <div id="slot-perfil" class="slotWrap" data-tab-scope="perfil" style="grid-column: 1 / -1;">${renderPerfilPanelHTML()}</div>

    <div id="slot-favs" class="slotWrap" data-tab-scope="apps" style="grid-column: 1 / -1;">${renderFavRowHTML()}</div>
    <div class="hubSearch" data-tab-scope="apps" style="grid-column: 1 / -1;">
      <span class="hubSearchIcon" aria-hidden="true">🔎</span>
      <input id="hubSearchInput" type="search" inputmode="search" autocomplete="off"
        placeholder="Buscar acceso… (ej: bitácora, biblioteca, QR, horarios)" aria-label="Buscar acceso en el HUB" />
      <button class="hubSearchClear" id="hubSearchClear" type="button" aria-label="Limpiar búsqueda" hidden>✕</button>
    </div>
    <div class="hubSearchEmpty" id="hubSearchEmpty" data-tab-scope="apps" hidden>
      <h2>Sin resultados</h2>
      <p>No encontramos accesos para esa búsqueda. Prueba con otra palabra.</p>
    </div>
  `;

  for (const [section, items] of sections.entries()) {
    html += `
      <div class="secBlock" data-sec="${escapeHtml(section)}" style="grid-column: 1 / -1;">
        <div class="secTitle">${escapeHtml(section)}</div>
      </div>
    `;

    html += items
      .map((button) => {
        const state = getResolvedButtonState(button, APP_STATE.activeLinks);
        const tileClass = state.available ? "tile" : "tile pending";
        const badge = state.available
          ? '<span class="badge ok">Abrir</span>'
          : '<span class="badge">Pendiente</span>';

        return `
          <button
            class="${tileClass}"
            type="button"
            data-id="${escapeHtml(button.id)}"
            data-sec="${escapeHtml(section)}"
            data-search="${escapeHtml(normalizeText(`${button.title} ${button.subtitle} ${section}`))}"
            aria-label="${escapeHtml(button.title)}"
          >
            <div class="tileTop">
              <div class="ico" aria-hidden="true">${escapeHtml(button.icon)}</div>
              ${badge}
            </div>
            <div class="tileText">
              <div class="tTitle">${escapeHtml(button.title)}</div>
              <div class="tSub">${escapeHtml(button.subtitle)}</div>
            </div>
          </button>
        `;
      })
      .join("");
  }

  grid.innerHTML = html;
  updateStudentMessagesBadge(APP_STATE.unreadStudentMessages);
  ensureMusiProfeBot();
  setupHubSearch(grid);
  ensureBottomNav();
  applyHubTab(APP_STATE.hubTab || "inicio");

  if (!grid.dataset.boundSup) {
    grid.dataset.boundSup = "true";
    grid.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-sup]");
      if (!btn) return;
      const action = btn.getAttribute("data-sup");
      if (action === "support") openSupportModal();
      else if (action === "favorites") openFavoritesModal();
      else if (action === "switchHub") openHubSwitcherModal();
      else if (action === "logout") $("#btn-logout")?.click();
      else if (action === "perfil") applyHubTab("perfil");
      else if (action === "ayuda") applyHubTab("soporte");
      else if (action === "back") applyHubTab("inicio");
      else if (action === "favEdit") { APP_STATE.favEdit = !APP_STATE.favEdit; refreshHubDataUI(); }
    });

    // Modo edición de favoritos: quitar tocando el favorito, agregar tocando una app.
    grid.addEventListener("click", (event) => {
      const unfav = event.target.closest("[data-unfav]");
      if (unfav) {
        event.preventDefault();
        event.stopPropagation();
        toggleFav(unfav.getAttribute("data-unfav"));
        return;
      }
      if (!APP_STATE.favEdit) return;
      const appBtn = event.target.closest(".tile[data-id]");
      if (!appBtn) return;
      event.preventDefault();
      event.stopPropagation();
      toggleFav(appBtn.getAttribute("data-id"));
      toast("Favoritos actualizados ⭐");
    }, { capture: true });
  }

  if (!grid.dataset.boundClick) {
    grid.dataset.boundClick = "true";
    grid.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button[data-id]");
        if (!button) return;

        const id = button.getAttribute("data-id");
        handleButtonAction(id, button);
      },
      { passive: true }
    );
  }
}

/* ============================================================================
   DATOS CONECTABLES (SLOTS DEL RENDER)
   ----------------------------------------------------------------------------
   Cada tarjeta del diseño nuevo lee de APP_STATE.hubData. Mientras un slot
   esté en null se dibuja igual pero marcado "Por conectar". Para conectar una
   fuente (Firestore, Sheets, webhook, lo que sea) solo hay que llamar:

     HubData.set("<slot>", <valor>)      // también expuesto en window.HubData

   SLOTS Y FORMA ESPERADA:
   - "nextClass"        → { title: "Ballet infantil", time: "10:00 a. m.", room: "Salón 3" }
                          FUENTE prevista: horario docente (Firestore, colección de horarios).
   - "pendingBitacoras" → { count: 3, items: [{ title, group, date, url }] }
                          FUENTE prevista: sistema de bitácoras de clase.
   - "kpis"             → { puntualidad: 94, bitacoras: 88, promedio: 4.7 }
                          FUENTE prevista: puntualidad = marcaciones de jornada;
                          bitacoras = % completadas; promedio = evaluaciones.
   - "monthlyProgress"  → { subidas: 8, meta: 10, puntualidad: 93, seguimiento: "Muy bien" }
                          FUENTE prevista: agregado mensual de bitácoras + jornada.
   - "academicPending"  → { count: 5 }
                          FUENTE prevista: bitácora de tareas académicas.

   Ejemplo de conexión (cuando exista la fuente):
     onSnapshot(doc(db, "indicadores", emailKey(user)), (snap) => {
       const d = snap.data() || {};
       HubData.set("kpis", { puntualidad: d.puntualidad, bitacoras: d.bitacoras, promedio: d.promedio });
     });
============================================================================ */
const HUB_DATA_DEFAULTS = {
  nextClass: null,
  calendarUpdates: null,
  pendingBitacoras: null,
  kpis: null,
  monthlyProgress: null,
  academicPending: null
};

APP_STATE.hubData = { ...HUB_DATA_DEFAULTS };

function setHubData(slot, value) {
  if (!(slot in HUB_DATA_DEFAULTS)) {
    console.warn(`[HubData] Slot desconocido: "${slot}". Slots válidos:`, Object.keys(HUB_DATA_DEFAULTS));
    return;
  }
  APP_STATE.hubData[slot] = value;
  refreshHubDataUI();
}

window.HubData = {
  set: setHubData,
  get: (slot) => APP_STATE.hubData[slot],
  reset: () => { APP_STATE.hubData = { ...HUB_DATA_DEFAULTS }; refreshHubDataUI(); },
  slots: Object.keys(HUB_DATA_DEFAULTS)
};

// "—" mientras el dato no esté conectado.
const slotValue = (v, suffix = "") => (v === null || v === undefined || v === "") ? "—" : `${v}${suffix}`;
const slotTag = '<span class="slotTag">Por conectar</span>';

function renderNextClassCardHTML() {
  const agenda = APP_STATE.hubData.calendarUpdates;
  const classCount = Number(agenda?.todayCount || 0);
  const changes = Number(agenda?.count || 0);
  const title = agenda?.error
    ? "No pudimos cargar tus clases"
    : agenda
      ? `Tienes ${classCount} clase${classCount === 1 ? "" : "s"} programada${classCount === 1 ? "" : "s"} hoy`
      : "Cargando tus clases…";
  const notifications = (agenda?.items || []).slice(0, 3)
    .map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  return `
    <button type="button" class="nextClassCard" data-slot="calendarUpdates" data-wix-bookings aria-label="Abrir Wix Bookings">
      <div class="nextClassIco" aria-hidden="true">📅</div>
      <div class="nextClassTxt">
        <p>Mi agenda</p>
        <h3>${escapeHtml(title)}</h3>
        ${agenda?.error ? "<span>Intenta actualizar la página.</span>" : notifications ? `<span>${notifications}</span>` : ""}
      </div>
      <span class="nextClassGo" aria-hidden="true">›</span>
    </button>
  `;
}

function renderCalendarUpdatesHTML() {
  const updates = APP_STATE.hubData.calendarUpdates;
  const count = Number(updates?.count || 0);
  const title = updates?.error
    ? "No pudimos verificar las novedades de agenda"
    : count
      ? `Tienes ${count} novedad${count === 1 ? "" : "es"} en tu agenda`
      : "No tienes novedades en tu agenda";
  const detail = updates?.error
    ? "Actualiza la página en unos minutos."
    : count
      ? "Toca para revisar los cambios en Wix Bookings."
      : "Abrir Wix Bookings";
  const latest = (updates?.items || []).slice(0, 2).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <button type="button" class="calendarUpdatesBanner" data-slot="calendarUpdates" data-wix-bookings>
      <span class="calendarUpdatesIcon" aria-hidden="true">🔔</span>
      <span class="calendarUpdatesText">
        <strong>${title}</strong>
        <em>${latest ? `<ul>${latest}</ul>` : escapeHtml(detail)}</em>
      </span>
      <span class="calendarUpdatesGo" aria-hidden="true">Revisar ›</span>
    </button>`;
}

function renderPendingBannerHTML() {
  const d = APP_STATE.hubData.pendingBitacoras;
  const count = d?.count ?? null;
  return `
    <button type="button" class="pendingBanner ${d ? "" : "slotEmpty"}" data-slot="pendingBitacoras" data-id="bitacoraClasesNueva">
      <span class="pendingDot">${escapeHtml(slotValue(count))}</span>
      <span class="pendingTxt">
        <strong>Tienes ${escapeHtml(slotValue(count))} bitácoras pendientes</strong>
        <em>Completa tus registros para mantenerte al día. ${d ? "" : slotTag}</em>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  `;
}

function renderKpiRowHTML() {
  const d = APP_STATE.hubData.kpis;
  const kpi = (label, value, cls) => `
    <div class="kpiChip ${cls} ${d ? "" : "slotEmpty"}">
      <span class="kpiLabel">${label}</span>
      <strong class="kpiValue">${escapeHtml(value)}</strong>
    </div>`;
  return `
    <div class="kpiRow" data-slot="kpis" aria-label="Indicadores del mes">
      ${kpi("Puntualidad", slotValue(d?.puntualidad, " %"), "kpiTeal")}
      ${kpi("Bitácoras", slotValue(d?.bitacoras, " %"), "kpiOrange")}
      ${kpi("Promedio", d ? `★ ${slotValue(d?.promedio)}` : "—", "kpiPink")}
      ${d ? "" : `<div class="kpiConnectNote">${slotTag}</div>`}
    </div>
  `;
}

function renderAcadPanelHTML() {
  const prog = APP_STATE.hubData.monthlyProgress;
  const pend = APP_STATE.hubData.pendingBitacoras;
  const acad = APP_STATE.hubData.academicPending;

  const pct = prog && prog.meta ? Math.min(100, Math.round((prog.subidas / prog.meta) * 100)) : 0;
  const items = (pend?.items || []).map((item) => `
    <div class="acadPendItem">
      <span class="acadPendIco" aria-hidden="true">📝</span>
      <span class="acadPendTxt">
        <strong>${escapeHtml(item.title || "Clase")}</strong>
        <em>${escapeHtml(item.group || "")}${item.group && item.date ? " · " : ""}${escapeHtml(item.date || "")}</em>
      </span>
      ${item.url ? `<a class="acadPendBtn" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Completar</a>` : ""}
    </div>
  `).join("");

  return `
    <article class="acadBanner ${acad ? "" : "slotEmpty"}" data-slot="academicPending">
      <span class="acadBannerTxt">
        <strong>Pendientes académicos</strong>
        <em>Tienes ${escapeHtml(slotValue(acad?.count))} pendientes por revisar ${acad ? "" : slotTag}</em>
      </span>
      <span class="acadBannerCount">${escapeHtml(slotValue(acad?.count))}</span>
    </article>

    <article class="progressCard ${prog ? "" : "slotEmpty"}" data-slot="monthlyProgress">
      <div class="progressHead">
        <h3>Mi progreso este mes</h3>
        ${prog ? "" : slotTag}
      </div>
      <div class="progressStats">
        <div class="pStat"><span>Bitácoras subidas</span><strong>${escapeHtml(slotValue(prog?.subidas))} <em>/ ${escapeHtml(slotValue(prog?.meta))}</em></strong></div>
        <div class="pStat"><span>Puntualidad</span><strong>${escapeHtml(slotValue(prog?.puntualidad, " %"))}</strong></div>
        <div class="pStat"><span>Seguimiento</span><strong class="pStatOk">${escapeHtml(slotValue(prog?.seguimiento))}</strong></div>
      </div>
      <div class="progressBar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${pct}%"></span>
      </div>
      ${prog && prog.meta ? `<p class="progressMeta">Meta sugerida: completa ${Math.max(0, prog.meta - prog.subidas)} bitácoras para quedar al día.</p>` : ""}
    </article>

    <article class="acadPendList ${pend?.items?.length ? "" : "slotEmpty"}" data-slot="pendingBitacoras-list">
      <h3>Pendientes por completar ${pend?.items?.length ? "" : slotTag}</h3>
      ${items || '<p class="acadPendEmpty">Aquí aparecerán tus bitácoras pendientes cuando se conecte la fuente.</p>'}
    </article>
  `;
}

/* ============================================================================
   FAVORITOS (fila editable en Apps) + PANTALLA "MI PERFIL"
============================================================================ */
const FAV_PINNED_KEY = "hubFavPinned";

function readPinnedFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_PINNED_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function writePinnedFavs(list) {
  try { localStorage.setItem(FAV_PINNED_KEY, JSON.stringify(list.slice(0, 8))); } catch {}
}

function toggleFav(id) {
  if (!id) return;
  let list = readPinnedFavs();
  list = list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-8);
  writePinnedFavs(list);
  refreshHubDataUI();
}

// Favoritos a mostrar: los fijados por el docente; si no hay, los 4 más usados.
function getFavButtons() {
  const available = (id) => {
    const meta = getButtonMeta(id);
    return meta && getResolvedButtonState(meta, APP_STATE.activeLinks).visible ? meta : null;
  };

  const pinned = readPinnedFavs().map(available).filter(Boolean);
  if (pinned.length) return pinned;

  return Object.entries(readFavUsage())
    .map(([id, count]) => ({ id, count: Number(count) || 0, meta: available(id) }))
    .filter((item) => item.meta && item.count)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((item) => item.meta);
}

function renderFavRowHTML() {
  const favs = getFavButtons();
  const editing = !!APP_STATE.favEdit;
  const pinnedSet = new Set(readPinnedFavs());

  const tiles = favs.map((meta) => `
    <button class="favTile ${editing ? "favEditing" : ""}" type="button"
      ${editing ? `data-unfav="${escapeHtml(meta.id)}"` : `data-id="${escapeHtml(meta.id)}"`}
      aria-label="${escapeHtml(meta.title)}">
      <span class="favIco" data-sec-color aria-hidden="true">${escapeHtml(meta.icon)}
        ${editing && pinnedSet.has(meta.id) ? '<span class="favRemove" aria-hidden="true">✕</span>' : ""}
      </span>
      <span class="favLabel">${escapeHtml(meta.title)}</span>
    </button>
  `).join("");

  return `
    <div class="favHead">
      <span class="favTitle">Favoritos</span>
      <button class="favEditBtn" type="button" data-sup="favEdit">${editing ? "Listo" : "Editar"}</button>
    </div>
    ${editing ? '<p class="favHint">Toca una app de la lista para agregarla; toca un favorito para quitarlo.</p>' : ""}
    <div class="favRow">${tiles || '<p class="favEmpty">Usa el HUB o toca "Editar" para elegir tus favoritos ⭐</p>'}</div>
  `;
}

// --- Mi perfil (se abre tocando el avatar o desde Soporte) ---
function renderPerfilPanelHTML() {
  const profile = APP_STATE.activeProfile;
  const user = APP_STATE.activeUser;
  const kpis = APP_STATE.hubData.kpis;
  const name = (profile?.label || prettyName(user) || "Docente").trim();
  const email = emailKey(user) || "—";
  const initial = (name.charAt(0) || "M").toUpperCase();
  const photo = String(user?.photoURL || "").trim();
  const kpiVal = (v, s = "") => (kpis && v !== undefined && v !== null) ? `${v}${s}` : "—";

  return `
    <div class="perfilHead">
      <button class="perfilBack" type="button" data-sup="back" aria-label="Volver">←</button>
      <h2>Mi perfil</h2>
    </div>

    <article class="perfilCard">
      <div class="perfilAvatar" aria-hidden="true">${photo ? `<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()" />` : ""}<span class="avatarInitial">${escapeHtml(initial)}</span></div>
      <div class="perfilTxt">
        <h3>${escapeHtml(name)}</h3>
        <span>Docente Musicala · <em class="perfilActive">● Activa</em></span>
      </div>
    </article>

    <div class="perfilActions">
      ${profile?.carnet ? '<button class="perfilBtnMain" type="button" data-id="carnet">Ver carnet</button>' : ""}
      <button class="perfilBtnDanger" type="button" data-sup="logout">Cerrar sesión</button>
    </div>

    ${profile?.carnet ? `
    <article class="perfilCarnet">
      <p>Carnet digital</p>
      <img src="${escapeHtml(profile.carnet)}" alt="Carnet de ${escapeHtml(name)}" loading="lazy"
        onerror="this.closest('.perfilCarnet').style.display='none';" />
    </article>` : ""}

    <article class="perfilInfo">
      <div class="perfilInfoRow"><span>Correo</span><strong>${escapeHtml(email)}</strong></div>
      <div class="perfilInfoRow"><span>Hub</span><strong>Docentes</strong></div>
      <div class="perfilInfoRow"><span>Estado</span><strong class="perfilActive">● Activa</strong></div>
    </article>

    <article class="perfilKpis ${kpis ? "" : "slotEmpty"}" data-slot="kpis">
      <h3>Indicadores del mes ${kpis ? "" : slotTag}</h3>
      <div class="kpiRow">
        <div class="kpiChip kpiTeal"><span class="kpiLabel">Puntualidad</span><strong class="kpiValue">${escapeHtml(kpiVal(kpis?.puntualidad, " %"))}</strong></div>
        <div class="kpiChip kpiOrange"><span class="kpiLabel">Bitácoras</span><strong class="kpiValue">${escapeHtml(kpiVal(kpis?.bitacoras, " %"))}</strong></div>
        <div class="kpiChip kpiPink"><span class="kpiLabel">Promedio</span><strong class="kpiValue">${kpis ? "★ " : ""}${escapeHtml(kpiVal(kpis?.promedio))}</strong></div>
      </div>
    </article>
  `;
}

// Pantalla "Soporte" (pestaña ❓): cómo funciona la app, reporte y utilidades.
function renderSoportePanelHTML() {
  return `
    <article class="supCard">
      <h3><span aria-hidden="true">❓</span> ¿Cómo funciona esta app?</h3>
      <div class="supSteps">
        <div class="supStep">Revisa tu información y accesos asignados al iniciar sesión.</div>
        <div class="supStep">Para clases en sede, registra ingreso y salida escaneando el QR.</div>
        <div class="supStep">Para clases a hogar o virtuales, usa el registro manual.</div>
        <div class="supStep">Al terminar tus clases, completa la bitácora para dejar evidencia.</div>
        <div class="supStep">Puedes instalar la app en tu dispositivo para abrirla más fácil.</div>
        <div class="supStep">En equipos compartidos, cierra sesión al terminar.</div>
        <div class="supStep">Si la cámara falla: permisos del navegador, buena luz y cámara correcta.</div>
      </div>
    </article>

    <article class="supCard">
      <h3><span aria-hidden="true">🛟</span> Soporte</h3>
      <p class="supTxt">¿Algo no funciona o tienes una idea? Cuéntanos y le hacemos seguimiento.</p>
      <button class="supBtnMain" type="button" data-sup="support">Reportar un problema</button>
    </article>

    <article class="supCard supList">
      <button class="supItem" type="button" data-sup="perfil"><span aria-hidden="true">👤</span> Mi perfil</button>
      <button class="supItem" type="button" data-sup="favorites"><span aria-hidden="true">⭐</span> Favoritos</button>
      <button class="supItem" type="button" data-sup="switchHub"><span aria-hidden="true">🧭</span> Cambiar Hub</button>
      <button class="supItem supDanger" type="button" data-sup="logout"><span aria-hidden="true">🚪</span> Cerrar sesión</button>
      <p class="supVersion">Versión ${escapeHtml(BUILD)}</p>
    </article>
  `;
}

// Repinta solo los contenedores de datos (no todo el grid).
function refreshHubDataUI() {
  const map = {
    "slot-nextclass": renderNextClassCardHTML,
    "slot-pending": renderPendingBannerHTML,
    "slot-kpis": renderKpiRowHTML,
    "slot-favs": renderFavRowHTML,
    "slot-perfil": renderPerfilPanelHTML
  };
  for (const [id, fn] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = fn();
  }
  document.querySelectorAll("[data-wix-bookings]").forEach((button) => {
    button.addEventListener("click", () => { window.location.href = WIX_BOOKINGS_URL; });
  });
}

function wixBookingChangedAt(booking) {
  const dates = [booking.cancellationReceivedAt, booking.updateReceivedAt,
    booking.rescheduleReceivedAt, booking.updatedAt, booking.createdAt]
    .map((value) => value?.toDate?.() || (value ? new Date(value) : null))
    .filter((value) => value && !Number.isNaN(value.getTime()));
  return dates.length ? new Date(Math.max(...dates.map((value) => value.getTime()))) : null;
}

function wixUpdateSummary(booking) {
  const student = booking.customerName || "Estudiante";
  const service = booking.serviceName || "clase";
  const status = String(booking.status || "").toLowerCase();
  if (status.includes("cancel")) return `${student} canceló ${service}.`;
  if (status.includes("resched") || status.includes("reagend")) return `${student} reprogramó ${service}.`;
  return `${student} actualizó ${service}.`;
}

async function loadCalendarUpdatesForActiveUser() {
  const email = emailKey(APP_STATE.activeUser);
  if (!APP_STATE.db || !email) return;
  try {
    const seen = await getDoc(doc(APP_STATE.db, "calendarLastSeen", email));
    const lastSeen = seen.exists() ? seen.data()?.lastSeenAt?.toDate?.() : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 45);
    const snapshot = await getDocs(query(
      collection(APP_STATE.db, "calendarioWix"),
      where("staffEmail", "==", email),
      where("startDate", ">=", Timestamp.fromDate(today)),
      where("startDate", "<", Timestamp.fromDate(horizon)),
      orderBy("startDate", "asc")
    ));
    const bookings = snapshot.docs.map((item) => item.data() || {});
    const changes = bookings
      .filter((booking) => {
        const changedAt = wixBookingChangedAt(booking);
        return lastSeen && changedAt && changedAt > lastSeen;
      })
      .sort((a, b) => wixBookingChangedAt(b) - wixBookingChangedAt(a));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayCount = bookings.filter((booking) => {
      const start = booking.startDate?.toDate?.() || new Date(booking.startDate || 0);
      return start >= today && start < tomorrow
        && !String(booking.status || "").toLowerCase().includes("cancel");
    }).length;
    setHubData("calendarUpdates", {
      count: changes.length,
      todayCount,
      items: changes.map(wixUpdateSummary)
    });
  } catch (error) {
    console.warn("No se pudieron cargar las novedades de Wix Bookings", error);
    setHubData("calendarUpdates", { count: 0, todayCount: 0, error: true });
  }
}

// Navegación inferior estilo app (Inicio / Académico / Apps).
// Cada pestaña muestra un subconjunto de secciones del grid; "apps" muestra todo.
const HUB_TAB_SECTIONS = {
  inicio: ["Mi trabajo hoy"],
  apps: null,
  soporte: [],
  perfil: []
};

function ensureBottomNav() {
  if ($("#hubNav")) return;
  const app = $("#view-app");
  if (!app) return;

  const nav = document.createElement("nav");
  nav.id = "hubNav";
  nav.className = "hubNav";
  nav.setAttribute("aria-label", "Navegación principal");
  nav.innerHTML = `
    <button class="hubNavBtn" type="button" data-tab="inicio" aria-label="Inicio">
      <span class="hubNavIco" aria-hidden="true">🏠</span><span class="hubNavTxt">Inicio</span>
    </button>
    <button class="hubNavBtn" type="button" data-tab="apps" aria-label="Apps">
      <span class="hubNavIco" aria-hidden="true">🔲</span><span class="hubNavTxt">Apps</span>
    </button>
    <button class="hubNavBtn" type="button" data-tab="soporte" aria-label="Soporte">
      <span class="hubNavIco" aria-hidden="true">❓</span><span class="hubNavTxt">Soporte</span>
    </button>
  `;
  app.appendChild(nav);

  nav.addEventListener("click", (event) => {
    const btn = event.target.closest(".hubNavBtn");
    if (!btn) return;
    applyHubTab(btn.dataset.tab || "inicio");
  });
}

function applyHubTab(tab = "inicio") {
  if (!HUB_TAB_SECTIONS.hasOwnProperty(tab)) tab = "inicio";
  APP_STATE.hubTab = tab;

  const grid = $("#grid");
  if (!grid) return;

  grid.dataset.tab = tab; // permite estilizar cada pestaña (ej: mini-iconos en Apps)

  $$(".hubNavBtn").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  });

  const allowed = HUB_TAB_SECTIONS[tab];
  $$(".secBlock, .tile", grid).forEach((el) => {
    const sec = el.dataset.sec || "";
    el.classList.toggle("tabHidden", Array.isArray(allowed) && !allowed.includes(sec));
  });

  $$("[data-tab-scope]", grid).forEach((el) => {
    el.classList.toggle("tabHidden", el.dataset.tabScope !== tab);
  });

  const hero = $(".hubHero", grid);
  if (hero) hero.classList.toggle("tabHidden", tab !== "inicio");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Buscador en vivo del HUB: filtra los accesos (tiles) por título/subtítulo/sección
// y oculta los encabezados de sección que quedan sin resultados.
function setupHubSearch(grid) {
  const input = $("#hubSearchInput", grid);
  if (!input) return;
  const clearBtn = $("#hubSearchClear", grid);
  const empty = $("#hubSearchEmpty", grid);

  const apply = () => {
    const q = normalizeText(input.value.trim());
    const tiles = $$(".tile", grid);
    let visibles = 0;

    tiles.forEach((tile) => {
      const hay = !q || (tile.dataset.search || "").includes(q);
      tile.classList.toggle("tileHidden", !hay);
      if (hay) visibles++;
    });

    // Oculta el título de una sección si ninguno de sus accesos quedó visible.
    $$(".secBlock", grid).forEach((block) => {
      const sec = block.dataset.sec;
      const anyVisible = tiles.some((t) => t.dataset.sec === sec && !t.classList.contains("tileHidden"));
      block.classList.toggle("tileHidden", !!q && !anyVisible);
    });

    if (clearBtn) clearBtn.hidden = !q;
    if (empty) empty.hidden = !(q && visibles === 0);
  };

  input.addEventListener("input", apply);
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      apply();
      input.focus();
    });
  }
}

function getMusiProfeAnswer(question = "") {
  const normalized = normalizeText(question);
  const found = MUSIPROFE_KNOWLEDGE.find((item) =>
    item.match.some((term) => normalized.includes(normalizeText(term)))
  );

  if (found) return found.answer;
  return "Puedo ayudarte con jornada, QR, cierre de sesión abierta, bitácoras, enlaces, cámara y recursos de clase. Escríbeme qué necesitas revisar.";
}

function isMusiProfeResourceQuestion(question = "") {
  const normalized = normalizeText(question);
  const directResource = MUSIPROFE_RESOURCE_WORDS.some((word) => normalized.includes(normalizeText(word)));
  const searchIntent = /(buscar|busca|buscame|encontrar|encuentra|necesito|quiero|hay|tienes)/.test(normalized);
  return directResource || (searchIntent && !!buildBibliotecaBotQuery(question));
}

function buildBibliotecaBotQuery(question = "") {
  const helper = new Set(MUSIPROFE_HELPER_WORDS.map(normalizeText));
  const tokens = searchTokens(question)
    .filter((token) => !helper.has(token))
    .filter((token) => token.length > 2);
  return [...new Set(tokens)].join(" ").trim();
}

function openBibliotecaSearch(query = "") {
  openBibliotecaModule();
  BIBLIO_STATE.search = query;
  BIBLIO_STATE.shown = 60;
  setTimeout(() => {
    const input = $("#biblioSearch", bibliotecaOverlay);
    if (!input) return;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, 80);
}

function renderMusiProfeResourceResults(query, matches) {
  return `
    <p class="musiProfeAnswerText">Encontr&eacute; ${matches.length} resultado${matches.length === 1 ? "" : "s"} en la Biblioteca para <strong>${escapeHtml(query)}</strong>. Te dejo los m&aacute;s cercanos:</p>
    <div class="musiProfeResults">
      ${matches.slice(0, 4).map(({ recurso }) => {
        const link = (Array.isArray(recurso.enlaces) ? recurso.enlaces : []).find((item) => /^https?:\/\//i.test(String(item?.url || "")));
        return `
          <article class="musiProfeResult">
            <strong>${escapeHtml(recurso.titulo || "Recurso sin titulo")}</strong>
            <span>${escapeHtml([recurso.area, recurso.tema].filter(Boolean).join(" - ") || "Biblioteca de Recursos")}</span>
            <div class="musiProfeResultActions">
              ${link ? `<a href="${escapeHtml(String(link.url))}" target="_blank" rel="noopener noreferrer">Abrir recurso</a>` : ""}
              <button type="button" data-biblio-query="${escapeHtml(query)}">Ver en Biblioteca</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
    <button class="musiProfeSearchAll" type="button" data-biblio-query="${escapeHtml(query)}">Abrir busqueda completa</button>
  `;
}

async function getMusiProfeBibliotecaAnswer(question = "") {
  const query = buildBibliotecaBotQuery(question);
  if (!query) {
    return `<p class="musiProfeAnswerText">Claro. Escribeme palabras como <strong>repertorio piano</strong>, <strong>partituras violin</strong> o <strong>diagnostico canto</strong> y busco en la Biblioteca.</p>`;
  }

  try {
    const access = getBibliotecaAccess();
    const recursos = await fetchBibliotecaRecursos();
    const visibles = recursos.filter((r) => canSeeRecurso(r, access));
    const minimumScore = bibliotecaMinimumSearchScore(query);
    const matches = visibles
      .map((recurso) => ({ recurso, score: bibliotecaSearchScore(recurso, query) }))
      .filter((item) => item.score >= minimumScore)
      .sort((a, b) => b.score - a.score || String(a.recurso.titulo || "").localeCompare(String(b.recurso.titulo || ""), "es"));

    if (!matches.length) {
      return `
        <p class="musiProfeAnswerText">No encontr&eacute; resultados claros para <strong>${escapeHtml(query)}</strong>. Prueba con menos palabras, por ejemplo <strong>piano repertorio</strong> o <strong>canciones piano</strong>.</p>
        <button class="musiProfeSearchAll" type="button" data-biblio-query="${escapeHtml(query)}">Buscar igual en Biblioteca</button>
      `;
    }

    return renderMusiProfeResourceResults(query, matches);
  } catch (error) {
    console.warn("MusiProfe no pudo buscar en la biblioteca", error);
    return `<p class="musiProfeAnswerText">Intente buscar en la Biblioteca, pero no pude cargar los recursos ahora. Revisa tu conexion o abre Biblioteca de Recursos e intenta de nuevo.</p>`;
  }
}

function addMusiProfeMessage(body, who = "bot", options = {}) {
  const log = $("#musiProfeLog");
  if (!log) return;

  const message = document.createElement("div");
  message.className = `musiProfeMsg ${who === "user" ? "fromUser" : "fromBot"}`;
  if (options.html) message.innerHTML = body;
  else message.textContent = body;
  log.appendChild(message);
  log.scrollTop = log.scrollHeight;
}

function ensureMusiProfeBot() {
  if ($("#musiProfeBot")) return;

  const bot = document.createElement("aside");
  bot.id = "musiProfeBot";
  bot.className = "musiProfeBot";
  bot.innerHTML = `
    <button class="musiProfeFab" id="musiProfeFab" type="button" aria-expanded="false" aria-controls="musiProfePanel">
      <span class="musiProfeAvatar" aria-hidden="true"><img src="./assets/musiprofe.png" alt="" /></span>
      <strong>¿Cómo les podemos ayudar?</strong>
    </button>
    <section class="musiProfePanel" id="musiProfePanel" hidden>
      <div class="musiProfeHead">
        <span class="musiProfeAvatar musiProfeAvatarPanel" aria-hidden="true"><img src="./assets/musiprofe.png" alt="" /></span>
        <div class="musiProfeTitle">
          <p>MusiProfe</p>
          <strong>Asistente docente</strong>
        </div>
        <button class="btnGhost compact" id="musiProfeClose" type="button">Cerrar</button>
      </div>
      <div class="musiProfeLog" id="musiProfeLog" aria-live="polite"></div>
      <div class="musiProfeChips">
        ${MUSIPROFE_SUGGESTIONS.map((item) => `<button type="button" data-musi-question="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
      </div>
      <form class="musiProfeForm" id="musiProfeForm">
        <input id="musiProfeInput" type="text" autocomplete="off" placeholder="Escribe tu duda" />
        <button type="submit">Enviar</button>
      </form>
    </section>
  `;

  document.body.appendChild(bot);
  const fab = $("#musiProfeFab", bot);
  const panel = $("#musiProfePanel", bot);
  const form = $("#musiProfeForm", bot);
  const input = $("#musiProfeInput", bot);

  const open = () => {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    if (!$("#musiProfeLog", bot)?.children.length) {
      addMusiProfeMessage("Hola, soy MusiProfe. Puedo orientarles con jornada, QR, bitácoras y accesos de la app.");
    }
    setTimeout(() => input?.focus(), 30);
  };

  const close = () => {
    panel.hidden = true;
    fab.setAttribute("aria-expanded", "false");
  };

  const answerQuestion = async (question) => {
    addMusiProfeMessage(question, "user");
    if (isMusiProfeResourceQuestion(question)) {
      const html = await getMusiProfeBibliotecaAnswer(question);
      addMusiProfeMessage(html, "bot", { html: true });
      return;
    }
    addMusiProfeMessage(getMusiProfeAnswer(question));
  };

  fab?.addEventListener("click", () => {
    if (panel.hidden) open();
    else close();
  });
  $("#musiProfeClose", bot)?.addEventListener("click", close);
  bot.querySelectorAll("[data-musi-question]").forEach((button) => {
    button.addEventListener("click", async () => {
      const question = button.getAttribute("data-musi-question") || "";
      await answerQuestion(question);
    });
  });
  bot.addEventListener("click", (event) => {
    const target = event.target.closest("[data-biblio-query]");
    if (!target) return;
    openBibliotecaSearch(target.getAttribute("data-biblio-query") || "");
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = String(input?.value || "").trim();
    if (!question) return;
    input.value = "";
    await answerQuestion(question);
  });
}

function ensureStudentsServices() {
  if (APP_STATE.studentsDb) return;
  const secondary = initializeApp(STUDENTS_FIREBASE_CONFIG, "estudiantes-mensajes");
  APP_STATE.studentsDb = getFirestore(secondary);
  APP_STATE.studentsAuth = getAuth(secondary);
  if (!APP_STATE.studentsAuthWired) {
    APP_STATE.studentsAuthWired = true;
    onAuthStateChanged(APP_STATE.studentsAuth, (user) => {
      if (user && APP_STATE.activeUser && emailKey(user) === emailKey(APP_STATE.activeUser)) {
        startStudentMessagesBadge();
      }
    });
  }
}

async function connectStudentsMessages() {
  ensureStudentsServices();
  if (emailKey(APP_STATE.studentsAuth.currentUser) === emailKey(APP_STATE.activeUser)) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: emailKey(APP_STATE.activeUser), prompt: "select_account" });
  const result = await signInWithPopup(APP_STATE.studentsAuth, provider);
  if (emailKey(result.user) !== emailKey(APP_STATE.activeUser)) {
    await signOut(APP_STATE.studentsAuth);
    throw new Error("Conecta la misma cuenta que usas en Docentes HUB.");
  }
}

function openStudentMessages() {
  let threadsUnsubscribe = null;
  let conversationUnsubscribe = null;
  let allThreads = [];
  let activeStudentId = "";
  const overlay = document.createElement("div");
  overlay.className = "adminSubModal";
  overlay.innerHTML = `<div class="adminSubCard adminSubCardWide messageHub" role="dialog" aria-modal="true">
    <div class="messageHubHead"><div><h3>Mensajes de estudiantes</h3><p class="adminSubSub">Privados entre estudiante, docente asignado y coordinación.</p></div><button class="btnGhost" id="messagesClose" type="button">Cerrar</button></div>
    <div id="messagesConnect"><button class="btnGoogle" id="messagesConnectBtn" type="button">Conectar mensajes</button><p class="adminNote">Google confirmará el acceso al Firebase académico la primera vez.</p></div>
    <div class="messageHubLayout" id="messagesLayout" hidden><aside class="messageInbox"><label class="messageSearch"><span>Buscar</span><input id="messageSearchInput" type="search" placeholder="Estudiante, docente o mensaje…" /></label><div id="messageInboxCount"></div><div id="messageThreads"></div></aside><section id="messageConversation"><div class="messageEmpty"><span>💬</span><strong>Elige una conversación</strong><p>Aquí podrás leer y responder sin perder de vista tu bandeja.</p></div></section></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => { threadsUnsubscribe?.(); conversationUnsubscribe?.(); overlay.remove(); };
  $("#messagesClose", overlay)?.addEventListener("click", close);

  const renderThreadList = () => {
    const term = normalizeText($("#messageSearchInput", overlay)?.value || "");
    const threads = allThreads.filter((thread) => !term || normalizeText(`${thread.studentName} ${thread.teacherName} ${thread.teacherEmail} ${thread.lastMessage}`).includes(term));
    const list = $("#messageThreads", overlay);
    $("#messageInboxCount", overlay).textContent = `${threads.length} conversación${threads.length === 1 ? "" : "es"}`;
    list.innerHTML = threads.length ? threads.map((thread) => {
      const date = thread.updatedAt?.toDate?.();
      const dateLabel = date ? date.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
      return `<button class="messageThread ${activeStudentId === thread.id ? "active" : ""}" data-id="${escapeHtml(thread.id)}" type="button"><span class="messageThreadAvatar">${escapeHtml((thread.studentName || "E").trim().charAt(0).toUpperCase())}</span><span class="messageThreadCopy"><strong>${escapeHtml(thread.studentName || thread.id)} ${thread.teacherUnread ? '<b class="messageNew">Nuevo</b>' : ""}</strong><span>${escapeHtml(thread.lastMessage || "Sin mensajes")}</span><small>${escapeHtml(thread.teacherName || thread.teacherEmail || "")}</small></span><time>${escapeHtml(dateLabel)}</time></button>`;
    }).join("") : `<div class="messageEmpty small"><strong>Sin resultados</strong><p>No encontramos conversaciones con esa búsqueda.</p></div>`;
    $$(".messageThread", list).forEach((button) => button.addEventListener("click", () => openConversation(button.dataset.id, allThreads.find((item) => item.id === button.dataset.id))));
  };

  const deleteConversation = async (studentId, thread) => {
    if (!isAdminUser(APP_STATE.activeUser)) return;
    if (!confirm(`¿Eliminar definitivamente la conversación con ${thread.studentName || studentId}? Esta acción no se puede deshacer.`)) return;
    const messages = await getDocs(collection(APP_STATE.studentsDb, "student_messages", studentId, "messages"));
    for (let index = 0; index < messages.docs.length; index += 400) {
      const batch = writeBatch(APP_STATE.studentsDb);
      messages.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
    await deleteDoc(doc(APP_STATE.studentsDb, "student_messages", studentId));
    activeStudentId = "";
    $("#messageConversation", overlay).innerHTML = `<div class="messageEmpty"><span>✓</span><strong>Conversación eliminada</strong></div>`;
    overlay.classList.remove("messageConversationOpen");
    toast("Conversación eliminada.");
  };

  const openConversation = (studentId, thread) => {
    activeStudentId = studentId;
    renderThreadList();
    overlay.classList.add("messageConversationOpen");
    conversationUnsubscribe?.();
    const panel = $("#messageConversation", overlay);
    const ref = collection(APP_STATE.studentsDb, "student_messages", studentId, "messages");
    conversationUnsubscribe = onSnapshot(query(ref, orderBy("createdAt", "asc"), limit(150)), async (snap) => {
      const messages = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      panel.innerHTML = `<div class="messageConversationHead"><button class="messageBack" type="button" aria-label="Volver a conversaciones">←</button><div><strong>${escapeHtml(thread.studentName || studentId)}</strong><span>Con ${escapeHtml(thread.teacherName || thread.teacherEmail || "docente")}</span></div>${isAdminUser(APP_STATE.activeUser) ? '<button class="messageDelete" type="button">Eliminar</button>' : ""}</div>
        <div class="messageBubbles">${messages.map((message) => `<article class="messageBubble ${message.senderRole === "teacher" ? "own" : ""}"><strong>${escapeHtml(message.senderName || message.senderRole)}</strong><p>${escapeHtml(message.text || "")}</p><time class="messageSentAt">${escapeHtml(messageSentAt(message))}</time></article>`).join("") || `<p class="adminNote">Aún no hay mensajes.</p>`}</div>
        <form class="messageComposer"><textarea rows="2" maxlength="800" placeholder="Escribe una respuesta…" required></textarea><button class="btnGoogle" type="submit">Enviar</button></form>`;
      $(".messageBack", panel)?.addEventListener("click", () => overlay.classList.remove("messageConversationOpen"));
      $(".messageDelete", panel)?.addEventListener("click", () => deleteConversation(studentId, thread));
      const composer = $(".messageComposer", panel);
      if (composer) {
        const emojiWrap = document.createElement("div");
        emojiWrap.className = "messageEmojiWrap";
        const emojiToggle = document.createElement("button");
        emojiToggle.className = "messageEmojiToggle";
        emojiToggle.type = "button";
        emojiToggle.textContent = "😊";
        emojiToggle.setAttribute("aria-label", "Agregar emoji");
        emojiToggle.setAttribute("aria-expanded", "false");
        const emojiPicker = document.createElement("div");
        emojiPicker.className = "messageEmojiPicker";
        emojiPicker.hidden = true;
        CHAT_QUICK_EMOJIS.forEach((emoji) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = emoji;
          button.setAttribute("aria-label", "Agregar " + emoji);
          button.addEventListener("click", () => {
            const input = $("textarea", composer);
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
            input.focus();
            input.setSelectionRange(start + emoji.length, start + emoji.length);
            emojiPicker.hidden = true;
            emojiToggle.setAttribute("aria-expanded", "false");
          });
          emojiPicker.appendChild(button);
        });
        emojiToggle.addEventListener("click", () => {
          const willOpen = emojiPicker.hidden;
          emojiPicker.hidden = !willOpen;
          emojiToggle.setAttribute("aria-expanded", String(willOpen));
        });
        emojiWrap.append(emojiToggle, emojiPicker);
        composer.prepend(emojiWrap);
      }
      const unread = messages.filter((message) => message.senderRole === "student" && message.read !== true);
      if (unread.length) {
        const batch = writeBatch(APP_STATE.studentsDb);
        unread.forEach((message) => batch.update(doc(APP_STATE.studentsDb, "student_messages", studentId, "messages", message.id), { read: true }));
        batch.commit().catch(() => {});
        setDoc(doc(APP_STATE.studentsDb, "student_messages", studentId), { teacherUnread: false }, { merge: true }).catch(() => {});
      }
      $(".messageComposer", panel)?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = $("textarea", event.currentTarget);
        const text = input.value.trim(); if (!text) return;
        await addDoc(ref, { studentId, teacherEmail: thread.teacherEmail, text, senderRole: "teacher", senderName: APP_STATE.activeProfile?.label || APP_STATE.activeUser?.displayName || "Docente", senderEmail: emailKey(APP_STATE.activeUser), read: false, createdAt: serverTimestamp(), createdAtClient: Date.now() });
        await setDoc(doc(APP_STATE.studentsDb, "student_messages", studentId), { lastMessage: text.slice(0, 160), lastSenderRole: "teacher", studentUnread: true, updatedAt: serverTimestamp() }, { merge: true });
        input.value = "";
      });
    });
  };

  const connect = async () => {
    try {
      await connectStudentsMessages();
      startStudentMessagesBadge();
      $("#messagesConnect", overlay).hidden = true;
      $("#messagesLayout", overlay).hidden = false;
      const base = collection(APP_STATE.studentsDb, "student_messages");
      const inboxQuery = isAdminUser(APP_STATE.activeUser)
        ? query(base, orderBy("updatedAt", "desc"), limit(100))
        : query(base, where("teacherEmail", "==", emailKey(APP_STATE.activeUser)), limit(100));
      threadsUnsubscribe = onSnapshot(inboxQuery, (snap) => {
        allThreads = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        renderThreadList();
      }, (error) => { console.error(error); toast("Publica primero las reglas de Estudiantes HUB."); });
    } catch (error) { console.error(error); toast(error?.message || "No se pudo conectar."); }
  };
  $("#messagesConnectBtn", overlay)?.addEventListener("click", connect);
  $("#messageSearchInput", overlay)?.addEventListener("input", renderThreadList);
  ensureStudentsServices();
  if (APP_STATE.studentsAuth.currentUser) connect();
}

/* ============================================================================
   VINCULACIÓN · DOCENTE DE APOYO
============================================================================ */
const SUPPORT_TERMS = [
  ["Prestación del servicio", "Actúas de manera autónoma e independiente. Puedes recibir clases, talleres, reemplazos y actividades previamente acordadas; su asignación depende de la necesidad de Musicala y de tu disponibilidad. No se garantiza un mínimo de horas, clases ni estudiantes."],
  ["Compromisos académicos", "Prepara y realiza las actividades aceptadas, registra asistencia y evidencias requeridas, entrega bitácoras o informes y aplica los principios pedagógicos y estándares de calidad de Musicala."],
  ["Programación y comunicación", "Informa tu disponibilidad, revisa la programación asignada y gestiona los cambios por los canales institucionales. No modifiques directamente horarios con estudiantes o acudientes e informa a tiempo cualquier impedimento."],
  ["Protección y buen trato", "Mantén una conducta respetuosa, protege la integridad física y emocional de estudiantes y cumple los protocolos de niños, niñas y adolescentes. Informa de inmediato situaciones de riesgo."],
  ["Confidencialidad y datos personales", "Protege la información de estudiantes, familias y Musicala. No copies, divulgues ni uses datos para fines personales, ni contactes familias para ofrecer servicios externos con información obtenida por la institución."],
  ["Pagos y seguridad social", "Los honorarios y condiciones de pago se informan según cada actividad asignada. Cuando corresponda, presentarás cuenta de cobro o factura y los documentos requeridos; conservas las obligaciones tributarias y de seguridad social que legalmente te correspondan."],
  ["Terminación o suspensión", "Cualquiera de las partes puede decidir no aceptar nuevas actividades. Las ya aceptadas se gestionan según lo acordado. Musicala puede finalizar la vinculación ante incumplimientos graves, riesgos para estudiantes o violaciones de confidencialidad." ]
];

function supportProfileComplete(profile = {}) {
  return ["fullName", "documentType", "documentNumber", "phone", "residenceCity", "artisticArea"].every((key) => String(profile[key] || "").trim());
}

function openAdminSupportDetail(email) {
  const profile = ADMIN_STATE.supportProfiles?.[email] || {};
  const history = Object.values(ADMIN_STATE.supportAcceptances || {}).filter((item) => item.teacherEmail === email)
    .sort((a, b) => (b.acceptedAt?.toMillis?.() || 0) - (a.acceptedAt?.toMillis?.() || 0));
  const fields = SUPPORT_PROFILE_FIELDS.map((key) => `<div class="perfilInfoRow"><span>${escapeHtml(key)}</span><strong>${escapeHtml(profile[key] || "Sin registrar")}</strong></div>`).join("");
  openDrawerActionModal("Detalle de vinculación", `<div class="supportContract"><section><h3>${escapeHtml(email)}</h3><div class="perfilInfo">${fields}</div></section><section><h3>Historial de aceptaciones</h3>${history.length ? history.map((item) => `<p><strong>Versión ${escapeHtml(item.contractVersion || "")}</strong> · ${escapeHtml(item.acceptedAt?.toDate?.().toLocaleString("es-CO") || "Registrando fecha")}</p>`).join("") : "<p class=\"adminNote\">Aún no hay aceptación registrada.</p>"}</section></div>`);
}

function openSupportContractPreview() {
  const fields = [
    ["Nombre completo", "Mariana Torres"], ["Tipo de documento", "Cédula de ciudadanía"], ["Número de documento", "•••• 1234"],
    ["Celular", "300 000 0000"], ["Ciudad de residencia", "Bogotá"], ["Área artística o especialidad", "Música"]
  ];
  openDrawerActionModal("Vista previa · Docente de apoyo", `<div class="supportContract supportPreview">
    <div class="supportStatus supportStatus-pending_acceptance">Pendiente de aceptación</div>
    <p class="supportIntro">Así verá esta sección una docente clasificada como Docente de apoyo.</p>
    <section><h3>Datos del docente</h3><div class="perfilInfo">${fields.map(([label, value]) => `<div class="perfilInfoRow"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div></section>
    <section><h3>¿Qué significa ser Docente de apoyo?</h3><p>Como Docente de apoyo puedes recibir propuestas para clases, talleres, reemplazos u otras actividades artísticas y pedagógicas ocasionales. La asignación depende de las necesidades de Musicala y de tu disponibilidad; no garantiza un mínimo de actividades.</p></section>
    <section><h3>Condiciones y documentos</h3>${SUPPORT_TERMS.map(([title, text]) => `<details><summary>${escapeHtml(title)}</summary><p>${escapeHtml(text)}</p></details>`).join("")}</section>
    <section><details open><summary>Condiciones completas de vinculación · versión ${SUPPORT_CONTRACT_VERSION}</summary><p>${escapeHtml(supportTermsText())}</p></details></section>
    <section class="supportAcceptance"><h3>Aceptación electrónica de las condiciones de vinculación</h3><label class="adminCheck"><input type="checkbox" disabled><span>Declaro que leí y acepto las condiciones presentadas.</span></label><label class="adminCheck"><input type="checkbox" disabled><span>Confirmo que los datos registrados corresponden a mi identidad.</span></label><button class="btnGoogle" type="button" disabled>Aceptar condiciones</button><p class="adminNote">Vista previa: los controles están deshabilitados para no crear una aceptación de prueba.</p></section>
  </div>`);
}

async function loadSupportAdminData() {
  const [profiles, acceptances] = await Promise.all([
    getDocs(collection(APP_STATE.db, "supportContractProfiles")),
    getDocs(collection(APP_STATE.db, "supportContractAcceptances"))
  ]);
  ADMIN_STATE.supportProfiles = Object.fromEntries(profiles.docs.map((item) => [item.id, item.data() || {}]));
  ADMIN_STATE.supportAcceptances = Object.fromEntries(acceptances.docs.map((item) => [item.id, item.data() || {}]));
}
function supportAcceptanceId(email = emailKey(APP_STATE.activeUser)) { return `${email}_${SUPPORT_CONTRACT_VERSION}`; }
function supportStatus(profile, acceptance) {
  if (!supportProfileComplete(profile)) return "incomplete";
  return acceptance ? "accepted" : "pending_acceptance";
}
function supportContractStatusLabel(status) { return ({ incomplete: "Datos pendientes", pending_acceptance: "Pendiente de aceptación", accepted: "Aceptado", outdated: "Requiere nueva aceptación" })[status] || "No aplica"; }
function supportTermsText() { return SUPPORT_TERMS.map(([title, text]) => `${title}\n${text}`).join("\n\n"); }

async function openSupportContract() {
  if (APP_STATE.hubUserDoc?.employmentType !== "support_contractor") { toast("Esta sección solo está disponible para Docentes de apoyo."); return; }
  const email = emailKey(APP_STATE.activeUser);
  const [profileSnap, acceptanceSnap] = await Promise.all([
    getDoc(doc(APP_STATE.db, "supportContractProfiles", email)),
    getDoc(doc(APP_STATE.db, "supportContractAcceptances", supportAcceptanceId(email)))
  ]);
  const profile = profileSnap.exists() ? profileSnap.data() : { fullName: APP_STATE.activeProfile?.label || APP_STATE.activeUser?.displayName || "" };
  const acceptance = acceptanceSnap.exists() ? acceptanceSnap.data() : null;
  renderSupportContract(profile, acceptance);
}

function openSupportContractModal(title, body) { return openDrawerActionModal(title, `<div class="supportContract">${body}</div>`); }

function renderSupportContract(profile, acceptance) {
  const status = supportStatus(profile, acceptance);
  const fields = [
    ["fullName", "Nombre completo", "text"], ["documentType", "Tipo de documento", "text"], ["documentNumber", "Número de documento", "text"],
    ["documentIssueCity", "Ciudad de expedición", "text"], ["phone", "Celular", "tel"], ["address", "Dirección", "text"],
    ["residenceCity", "Ciudad de residencia", "text"], ["artisticArea", "Área artística o especialidad", "text"]
  ];
  const acceptedAt = acceptance?.acceptedAt?.toDate?.() || null;
  const locked = !!acceptance;
  const dataForm = fields.map(([key, label, type]) => `<label>${label}<input ${locked ? "disabled" : ""} type="${type}" data-support-field="${key}" maxlength="160" value="${escapeHtml(profile[key] || "")}" /></label>`).join("");
  const modal = openSupportContractModal("Mi vinculación como Docente de apoyo", `
    <div class="supportStatus supportStatus-${status}">${escapeHtml(supportContractStatusLabel(status))}</div>
    <p class="supportIntro">Consulta tus datos, las condiciones de prestación del servicio y el estado de tu aceptación electrónica.</p>
    ${locked ? `<section class="supportAccepted"><h3>Condiciones aceptadas</h3><p>Tu aceptación fue registrada correctamente.</p><p><strong>${escapeHtml(acceptance.acceptedByName || "")}</strong> · ${escapeHtml(String(acceptance.acceptedByDocumentNumber || "").replace(/.(?=.{4})/g, "•"))}<br>Versión ${escapeHtml(acceptance.contractVersion)} · ${acceptedAt ? acceptedAt.toLocaleString("es-CO") : "Registrando fecha"}</p></section>` : `
      <section><h3>Datos del docente</h3><p class="adminNote">Los campos marcados son necesarios antes de aceptar. El correo de la aceptación será el de tu sesión: <strong>${escapeHtml(emailKey(APP_STATE.activeUser))}</strong>.</p><div class="supportFields">${dataForm}</div><button class="btnGhost" type="button" id="supportSaveProfile">Guardar datos</button></section>
      <section><h3>¿Qué significa ser Docente de apoyo?</h3><p>Como Docente de apoyo puedes recibir propuestas para clases, talleres, reemplazos u otras actividades artísticas y pedagógicas ocasionales. La asignación depende de las necesidades de Musicala y de tu disponibilidad; no garantiza un mínimo de actividades. Cada servicio aceptado exige puntualidad, preparación, responsabilidad, buen trato y protección especial de niños, niñas y adolescentes.</p></section>
      <section><h3>Condiciones y documentos</h3>${SUPPORT_TERMS.map(([title, text]) => `<details><summary>${escapeHtml(title)}</summary><p>${escapeHtml(text)}</p></details>`).join("")}</section>
      <section><details id="supportFullTerms"><summary>Condiciones completas de vinculación · versión ${SUPPORT_CONTRACT_VERSION}</summary><p>Estas condiciones regulan la aceptación electrónica inicial como prestador independiente de servicios artísticos y pedagógicos. No constituyen una firma digital certificada ni fijan valores, duración u horas particulares. ${escapeHtml(supportTermsText())}</p></details></section>
      <section class="supportAcceptance"><h3>Aceptación electrónica de las condiciones de vinculación</h3><label class="adminCheck"><input type="checkbox" id="supportAcceptTerms" disabled><span>Declaro que leí, comprendí y acepto las condiciones, el resumen de normas, los compromisos académicos, la confidencialidad y los lineamientos presentados.</span></label><label class="adminCheck"><input type="checkbox" id="supportConfirmData"><span>Confirmo que los datos registrados son correctos y corresponden a mi identidad.</span></label><button class="btnGoogle" id="supportAcceptBtn" type="button" disabled>Aceptar condiciones</button></section>`}
  `);
  if (locked) return;
  const save = async () => {
    const values = { email: emailKey(APP_STATE.activeUser), updatedAt: serverTimestamp() };
    modal.querySelectorAll("[data-support-field]").forEach((input) => { values[input.dataset.supportField] = input.value.trim(); });
    await setDoc(doc(APP_STATE.db, "supportContractProfiles", values.email), values, { merge: true });
    toast("Datos guardados.");
    return values;
  };
  $("#supportSaveProfile", modal)?.addEventListener("click", async () => { try { await save(); } catch (e) { console.error(e); toast("No se pudieron guardar los datos."); } });
  const fullTerms = $("#supportFullTerms", modal), termsCheck = $("#supportAcceptTerms", modal), confirmCheck = $("#supportConfirmData", modal), acceptBtn = $("#supportAcceptBtn", modal);
  fullTerms?.addEventListener("toggle", () => { if (fullTerms.open) { termsCheck.disabled = false; } });
  const updateAccept = () => { acceptBtn.disabled = !(supportProfileComplete(Object.fromEntries(Array.from(modal.querySelectorAll("[data-support-field]")).map((el) => [el.dataset.supportField, el.value.trim()]))) && termsCheck.checked && confirmCheck.checked); };
  modal.querySelectorAll("[data-support-field]").forEach((input) => input.addEventListener("input", updateAccept)); termsCheck?.addEventListener("change", updateAccept); confirmCheck?.addEventListener("change", updateAccept);
  acceptBtn?.addEventListener("click", async () => {
    let values;
    try { values = await save(); } catch (_) { return; }
    if (!supportProfileComplete(values)) { toast("Completa los datos obligatorios antes de aceptar."); return; }
    if (!confirm("Al continuar quedará registrada tu aceptación electrónica junto con la fecha, la versión de las condiciones y los datos de tu cuenta.")) return;
    acceptBtn.disabled = true; acceptBtn.textContent = "Registrando…";
    try {
      await setDoc(doc(APP_STATE.db, "supportContractAcceptances", supportAcceptanceId()), {
        teacherEmail: values.email, userId: APP_STATE.activeUser.uid, contractVersion: SUPPORT_CONTRACT_VERSION, acceptedAt: serverTimestamp(),
        acceptedByName: values.fullName, acceptedByDocumentType: values.documentType, acceptedByDocumentNumber: values.documentNumber,
        acceptedEmail: values.email, termsSnapshot: supportTermsText(), status: "accepted"
      });
      modal.remove(); toast("Condiciones aceptadas y registradas correctamente."); openSupportContract();
    } catch (e) { console.error(e); toast("No se pudo registrar la aceptación. Intenta nuevamente."); acceptBtn.disabled = false; acceptBtn.textContent = "Aceptar condiciones"; }
  });
}

async function handleButtonAction(id, trigger = null) {
  if (!id) return;

  trackButtonUsage(id);

  if (id === "disponibilidad") {
    openAvailability({ db: APP_STATE.db, email: emailKey(APP_STATE.activeUser), isAdmin: isAdminUser() });
    return;
  }

  if (id === "carnet") {
    openCarnet(APP_STATE.activeProfile);
    return;
  }

  if (id === "jornada") {
    openTeacherShiftModal();
    return;
  }

  if (id === "horarioAnual") {
    openTeacherScheduleView();
    return;
  }

  if (id === "adminPanel") {
    openAdminPanel();
    return;
  }

  if (id === "bitacoraAcademica" || id === "academicModule") {
    openAcademicModule();
    return;
  }

  if (id === "bibliotecaRecursos") {
    openBibliotecaModule();
    return;
  }

  if (id === "studentMessages") {
    openStudentMessages();
    return;
  }

  if (id === "supportContract") {
    openSupportContract();
    return;
  }

  const url = String(APP_STATE.activeLinks?.[id] || "").trim();
  if (!url) {
    toast(`Aún no tienes un link asignado para “${getButtonTitle(id)}” 🙃`);
    return;
  }

  if (!openExternal(url)) {
    toast("Ese link está raro y lo bloqueé 😶‍🌫️");
  }
}

/* ============================================================================
   11d) MÓDULO INTERNO: BITÁCORA ACADÉMICA (iframe overlay)
   ----------------------------------------------------------------------------
   Abre modules/bitacora-academica dentro del HUB, pasando el contexto de la
   docente (correo, nombre, rol). El módulo resuelve su fuente de datos en
   modules/bitacora-academica/teachers.js. No se abre una app externa.
============================================================================ */
let academicOverlay = null;
let academicMsgWired = false;

function buildAcademicModuleUrl() {
  const user = APP_STATE.activeUser;
  const email = emailKey(user);
  const name = getTeacherName();
  const role = isAdminUser() ? "admin" : "docente";
  const params = new URLSearchParams({
    email,
    name,
    role,
    embedded: "1",
    v: BUILD
  });
  return `./modules/bitacora-academica/index.html?${params.toString()}`;
}

function openAcademicModule() {
  // Disponible para cualquier usuario autenticado en el HUB.
  // Escucha el "Volver al HUB" del iframe una sola vez.
  if (!academicMsgWired) {
    window.addEventListener("message", (event) => {
      if (event?.data?.type === "closeAcademicModule") closeAcademicModule();
    });
    academicMsgWired = true;
  }

  if (!academicOverlay) {
    academicOverlay = document.createElement("div");
    academicOverlay.id = "academicOverlay";
    academicOverlay.className = "academicOverlay";
    academicOverlay.innerHTML = `
      <div class="academicBar">
        <span class="academicBarTitle">🎯 Bitácora Académica</span>
        <button class="btnGhost" id="academicCloseBtn" type="button" aria-label="Cerrar módulo">Cerrar ✕</button>
      </div>
      <iframe id="academicFrame" class="academicFrame" title="Bitácora Académica"
        referrerpolicy="no-referrer"></iframe>
    `;
    document.body.appendChild(academicOverlay);
    $("#academicCloseBtn", academicOverlay)?.addEventListener("click", closeAcademicModule);
  }

  const frame = $("#academicFrame", academicOverlay);
  if (frame) frame.src = buildAcademicModuleUrl();

  academicOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAcademicModule() {
  if (!academicOverlay) return;
  academicOverlay.hidden = true;
  document.body.style.overflow = "";
  const frame = $("#academicFrame", academicOverlay);
  if (frame) frame.src = "about:blank"; // libera recursos
}

/* ============================================================================
   11e) MÓDULO INTERNO: BIBLIOTECA DE RECURSOS
   ----------------------------------------------------------------------------
   Lee la colección "recursos" del proyecto Firebase de la biblioteca (lectura
   pública) y muestra solo lo que corresponde a las áreas del docente:
   - Admins ven todo.
   - Docente con especialidades dentro de un área macro: solo esas especialidades.
   - Docente con área macro sin especialidades: toda el área macro.
   - Recursos "generales" (sala de profesores, vacacionales, sin área): todos.
============================================================================ */
function getBibliotecaDb() {
  if (APP_STATE.bibliotecaDb) return APP_STATE.bibliotecaDb;
  const app = initializeApp(BIBLIOTECA_FIREBASE_CONFIG, "biblioteca");
  APP_STATE.bibliotecaDb = getFirestore(app);
  return APP_STATE.bibliotecaDb;
}

// Mapea un área granular de la biblioteca (guitarra, ballet, dibujo…) a su
// área macro. "*" significa recurso general visible para cualquier docente.
function macroAreaForBibliotecaArea(areaRaw) {
  const area = normalizeText(areaRaw);
  if (!area) return "*";
  if (isGeneralBibliotecaArea(area)) return "*";
  if (/(ballet|danza|baile)/.test(area)) return "Danzas";
  if (/(dibujo|pintura|escultura|plastic|manualidad|ceramica)/.test(area)) return "Artes plásticas";
  if (/(teatro|actuacion|impro|dramat)/.test(area)) return "Teatro";
  return "Música";
}

// Algunos recursos antiguos usan "general" o "teoria-musical" como área,
// mientras que el catálogo de asignación usa nombres más legibles. Centramos
// aquí esas equivalencias para que una especialidad no dependa del formato con
// el que se importó originalmente el recurso.
function isGeneralBibliotecaArea(areaRaw) {
  const area = normalizeText(areaRaw);
  return !area || /^(general|sin[- ]?area|todos?)$/.test(area)
    || /(sala de profesores|vacacional)/.test(area);
}

function canonicalBibliotecaEspecialidad(areaRaw) {
  const area = normalizeText(areaRaw);
  if (/^teoria([ -].*)?$/.test(area)) return "teoria";
  if (/^ukelele([ -].*)?$/.test(area)) return "ukelele";
  return area;
}

// Disciplinas conocidas → nombre de carpeta al inicio de la biblioteca.
const BIBLIO_DISCIPLINA_LABELS = {
  "musica": "Música",
  "danza": "Danzas",
  "danzas": "Danzas",
  "artes-plasticas": "Artes plásticas",
  "teatro": "Teatro",
  "institucional": "Institucional",
  "minijuegos": "Minijuegos"
};

// Macro de un recurso completo: la disciplina del recurso manda; cualquier
// disciplina (incluidas las nuevas creadas en el admin) es una carpeta propia
// al inicio. Solo si el recurso no tiene disciplina se infiere desde el área.
function macroForRecurso(recurso) {
  const disc = normalizeText(recurso?.disciplina);
  if (disc) {
    if (BIBLIO_DISCIPLINA_LABELS[disc]) return BIBLIO_DISCIPLINA_LABELS[disc];
    const raw = String(recurso.disciplina).trim().replace(/-/g, " ");
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  return macroAreaForBibliotecaArea(recurso?.area);
}

// Macros que se restringen por áreas del docente; el resto (Institucional,
// Minijuegos y disciplinas nuevas) es visible para cualquier docente activo.
const BIBLIO_MACROS_RESTRINGIDOS = new Set(["Música", "Danzas", "Artes plásticas", "Teatro"]);

function getBibliotecaAccess() {
  if (isAdminUser()) return { all: true, areas: [], especialidades: [] };
  const docData = APP_STATE.hubUserDoc || {};
  const areas = Array.isArray(docData.areas) ? docData.areas : [];
  const especialidades = Array.isArray(docData.especialidades)
    ? docData.especialidades.map(normalizeText).filter(Boolean)
    : [];
  return { all: false, areas, especialidades };
}

function canSeeRecurso(recurso, access) {
  if (access.all) return true;
  const hasConfig = access.areas.length > 0 || access.especialidades.length > 0;
  if (!hasConfig) return false;

  // "general" es material transversal: no debe desaparecer cuando una
  // docente tenga una lista de especialidades limitada.
  if (isGeneralBibliotecaArea(recurso?.area)) return true;

  const area = canonicalBibliotecaEspecialidad(recurso?.area);
  const macro = macroForRecurso(recurso);
  // Recursos generales, institucionales y de disciplinas transversales
  // (minijuegos, etc.): visibles para cualquier docente activo.
  if (macro === "*" || !BIBLIO_MACROS_RESTRINGIDOS.has(macro)) return true;

  if (!access.areas.includes(macro)) {
    // No tiene el área macro: solo ve la especialidad si está asignada explícitamente.
    return access.especialidades.includes(area);
  }
  // Tiene el área macro: si definió especialidades dentro de ese macro, restringe a esas.
  const espInMacro = access.especialidades.filter((e) => macroAreaForBibliotecaArea(e) === macro);
  return espInMacro.length ? espInMacro.includes(area) : true;
}

async function fetchBibliotecaRecursos(force = false) {
  if (!force && Array.isArray(APP_STATE.bibliotecaCache.recursos)) {
    return APP_STATE.bibliotecaCache.recursos;
  }
  const snap = await getDocs(collection(getBibliotecaDb(), "recursos"));
  const list = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const estado = String(data.estado || "publicado").toLowerCase();
    if (estado !== "publicado") return;
    list.push({ id: d.id, ...data });
  });
  list.sort((a, b) => String(a.titulo || "").localeCompare(String(b.titulo || ""), "es"));
  APP_STATE.bibliotecaCache.recursos = list;
  return list;
}

async function fetchBibliotecaAreasConfig() {
  if (Array.isArray(APP_STATE.bibliotecaCache.areasConfig)) {
    return APP_STATE.bibliotecaCache.areasConfig;
  }
  try {
    const snap = await getDoc(doc(getBibliotecaDb(), "config", "areas"));
    const lista = snap.exists() ? snap.data()?.lista : null;
    APP_STATE.bibliotecaCache.areasConfig = Array.isArray(lista) ? lista : [];
  } catch (err) {
    console.warn("No se pudo leer config/areas de la biblioteca", err);
    APP_STATE.bibliotecaCache.areasConfig = [];
  }
  return APP_STATE.bibliotecaCache.areasConfig;
}

const BIBLIO_STATE = {
  search: "",
  tipo: "",
  shown: 60,
  // Navegación tipo carpetas (4 niveles): arte (macro) → área → tema → recursos.
  // null en navArte = vista de artes; navArte sin navArea = vista de áreas; etc.
  navArte: null,
  navArea: null,
  navTema: null
};

let bibliotecaOverlay = null;

function openBibliotecaModule() {
  if (!bibliotecaOverlay) {
    bibliotecaOverlay = document.createElement("div");
    bibliotecaOverlay.id = "bibliotecaOverlay";
    bibliotecaOverlay.className = "academicOverlay";
    bibliotecaOverlay.innerHTML = `
      <div class="academicBar">
        <span class="academicBarTitle">📚 Biblioteca de Recursos</span>
        <button class="btnGhost" id="bibliotecaCloseBtn" type="button" aria-label="Cerrar módulo">Cerrar ✕</button>
      </div>
      <div class="biblioBody" id="biblioBody">
        <p class="biblioLoading">Cargando recursos…</p>
      </div>
    `;
    document.body.appendChild(bibliotecaOverlay);
    $("#bibliotecaCloseBtn", bibliotecaOverlay)?.addEventListener("click", closeBibliotecaModule);
  }

  bibliotecaOverlay.hidden = false;
  document.body.style.overflow = "hidden";
  BIBLIO_STATE.search = "";
  BIBLIO_STATE.tipo = "";
  BIBLIO_STATE.shown = 60;
  BIBLIO_STATE.navArte = null;
  BIBLIO_STATE.navArea = null;
  BIBLIO_STATE.navTema = null;
  loadBiblioteca();
}

function closeBibliotecaModule() {
  if (!bibliotecaOverlay) return;
  bibliotecaOverlay.hidden = true;
  document.body.style.overflow = "";
}

async function loadBiblioteca() {
  const body = $("#biblioBody", bibliotecaOverlay);
  if (!body) return;

  const access = getBibliotecaAccess();
  if (!access.all && !access.areas.length && !access.especialidades.length) {
    body.innerHTML = `
      <div class="biblioEmpty">
        <h2>Aún no tienes áreas asignadas 🎨🎵</h2>
        <p>Pídele a coordinación que te asigne tu(s) área(s) — Música, Danzas, Artes plásticas o Teatro — desde el panel admin, pestaña <strong>Docentes</strong>. Apenas las tengas, aquí verás los recursos de tus clases.</p>
      </div>
    `;
    return;
  }

  body.innerHTML = `<p class="biblioLoading">Cargando recursos…</p>`;
  let recursos;
  try {
    recursos = await fetchBibliotecaRecursos();
  } catch (err) {
    console.error("Biblioteca:", err);
    body.innerHTML = `<div class="biblioEmpty"><h2>No se pudo cargar la biblioteca 😞</h2><p>Revisa tu conexión e inténtalo de nuevo.</p></div>`;
    return;
  }

  const visibles = recursos.filter((r) => canSeeRecurso(r, access));
  renderBiblioteca(body, visibles, access);
}

// Color estable por área (tono HSL derivado del nombre) para reconocerlas de un vistazo.
function biblioAreaHue(area) {
  const s = normalizeText(area || "general");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function biblioAreaEmoji(area) {
  const a = normalizeText(area || "");
  if (a.includes("guitarra")) return "🎸";
  if (a.includes("bajo")) return "🎸";
  if (a.includes("piano")) return "🎹";
  if (a.includes("bateria") || a.includes("percusion")) return "🥁";
  if (a.includes("violin") || a.includes("cuerdas")) return "🎻";
  if (a.includes("canto") || a.includes("voz") || a.includes("coro")) return "🎤";
  if (a.includes("danza") || a.includes("ballet") || a.includes("baile")) return "💃";
  if (a.includes("teatro")) return "🎭";
  if (a.includes("plastica") || a.includes("dibujo") || a.includes("pintura") || a.includes("arte")) return "🎨";
  if (a.includes("institucional")) return "🏫";
  if (a.includes("minijuego") || a.includes("juego")) return "🎮";
  if (a.includes("musica")) return "🎵";
  return "📁";
}

function renderBiblioteca(body, visibles, access) {
  // Agrupación arte (macro) → área → tema → recursos para la navegación tipo carpetas.
  const byArte = new Map();
  visibles.forEach((r) => {
    const macro = macroForRecurso(r);
    const arte = macro === "*" ? "General" : macro;
    const area = String(r.area || "").trim() || "General";
    const tema = String(r.tema || "").trim() || "Sin tema";
    if (!byArte.has(arte)) byArte.set(arte, new Map());
    const byArea = byArte.get(arte);
    if (!byArea.has(area)) byArea.set(area, new Map());
    const temas = byArea.get(area);
    if (!temas.has(tema)) temas.set(tema, []);
    temas.get(tema).push(r);
  });
  // "General" siempre al final; el resto alfabético.
  const arteNames = [...byArte.keys()].sort((a, b) => {
    if (a === "General") return 1;
    if (b === "General") return -1;
    return a.localeCompare(b, "es");
  });
  const arteCount = (arte) => [...byArte.get(arte).values()]
    .reduce((acc, temas) => acc + [...temas.values()].reduce((s, arr) => s + arr.length, 0), 0);
  const tipos = [...new Set(visibles.map((r) => String(r.tipo || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));

  const accessLabel = access.all
    ? "Vista de administrador: biblioteca completa"
    : `Tus áreas: ${access.areas.join(", ") || "—"}${access.especialidades.length ? ` · Especialidades: ${access.especialidades.join(", ")}` : ""}`;

  // Si la carpeta guardada ya no existe (cambio de filtros/datos), vuelve al inicio.
  if (BIBLIO_STATE.navArte && !byArte.has(BIBLIO_STATE.navArte)) {
    BIBLIO_STATE.navArte = null;
    BIBLIO_STATE.navArea = null;
    BIBLIO_STATE.navTema = null;
  }
  if (BIBLIO_STATE.navArea && !byArte.get(BIBLIO_STATE.navArte)?.has(BIBLIO_STATE.navArea)) {
    BIBLIO_STATE.navArea = null;
    BIBLIO_STATE.navTema = null;
  }
  if (BIBLIO_STATE.navTema && !byArte.get(BIBLIO_STATE.navArte)?.get(BIBLIO_STATE.navArea)?.has(BIBLIO_STATE.navTema)) {
    BIBLIO_STATE.navTema = null;
  }

  body.innerHTML = `
    <div class="biblioToolbar">
      <input type="search" id="biblioSearch" placeholder="Buscar en toda la biblioteca…" value="${escapeHtml(BIBLIO_STATE.search)}" />
      <select id="biblioTipo">
        <option value="">Tipo: todos</option>
        ${tipos.map((t) => `<option value="${escapeHtml(t)}" ${BIBLIO_STATE.tipo === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
      </select>
    </div>
    <nav class="biblioCrumbs" id="biblioCrumbs"></nav>
    <p class="biblioMeta">${accessLabel}</p>
    <div class="biblioGrid" id="biblioGrid"></div>
    <div class="biblioMore" id="biblioMoreWrap" hidden>
      <button class="btnGoogle" id="biblioMoreBtn" type="button">Mostrar más</button>
    </div>
  `;

  const folderCard = ({ emoji, name, count, sub, nav }) => `
    <button class="biblioFolder" type="button" data-nav="${escapeHtml(nav)}" style="--folderHue:${biblioAreaHue(name)}">
      <span class="biblioFolderIcon">${emoji}</span>
      <span class="biblioFolderName">${escapeHtml(name)}</span>
      <span class="biblioFolderMeta">${sub ? `${escapeHtml(sub)} · ` : ""}${count} recurso(s)</span>
    </button>
  `;

  const paintCrumbs = () => {
    const crumbs = $("#biblioCrumbs", body);
    if (!crumbs) return;
    const searching = !!normalizeText(BIBLIO_STATE.search);
    const parts = [`<button class="biblioCrumb" type="button" data-crumb="root">📚 Inicio</button>`];
    // Las migas de navegación se muestran siempre, incluso al buscar, para dejar
    // claro que la búsqueda está acotada a la carpeta actual (arte/área/tema).
    if (BIBLIO_STATE.navArte) {
      parts.push(`<span class="biblioCrumbSep">›</span>`);
      parts.push((BIBLIO_STATE.navArea || BIBLIO_STATE.navTema)
        ? `<button class="biblioCrumb" type="button" data-crumb="arte">${biblioAreaEmoji(BIBLIO_STATE.navArte)} ${escapeHtml(BIBLIO_STATE.navArte)}</button>`
        : `<span class="biblioCrumbHere">${biblioAreaEmoji(BIBLIO_STATE.navArte)} ${escapeHtml(BIBLIO_STATE.navArte)}</span>`);
    }
    if (BIBLIO_STATE.navArea) {
      parts.push(`<span class="biblioCrumbSep">›</span>`);
      parts.push(BIBLIO_STATE.navTema
        ? `<button class="biblioCrumb" type="button" data-crumb="area">${biblioAreaEmoji(BIBLIO_STATE.navArea)} ${escapeHtml(BIBLIO_STATE.navArea)}</button>`
        : `<span class="biblioCrumbHere">${biblioAreaEmoji(BIBLIO_STATE.navArea)} ${escapeHtml(BIBLIO_STATE.navArea)}</span>`);
    }
    if (BIBLIO_STATE.navTema) {
      parts.push(`<span class="biblioCrumbSep">›</span><span class="biblioCrumbHere">📂 ${escapeHtml(BIBLIO_STATE.navTema)}</span>`);
    }
    if (searching) {
      parts.push(`<span class="biblioCrumbSep">›</span><span class="biblioCrumbHere">🔎 Resultados de búsqueda</span>`);
    }
    crumbs.innerHTML = parts.join("");
    crumbs.querySelectorAll("[data-crumb]").forEach((b) => {
      b.addEventListener("click", () => {
        if (b.dataset.crumb === "root") {
          BIBLIO_STATE.navArte = null;
          BIBLIO_STATE.navArea = null;
          BIBLIO_STATE.navTema = null;
          BIBLIO_STATE.search = "";
          const input = $("#biblioSearch", body);
          if (input) input.value = "";
        } else if (b.dataset.crumb === "arte") {
          BIBLIO_STATE.navArea = null;
          BIBLIO_STATE.navTema = null;
        } else {
          BIBLIO_STATE.navTema = null;
        }
        BIBLIO_STATE.shown = 60;
        paint();
      });
    });
  };

  const paintRecursos = (lista, grid, moreWrap) => {
    const filtered = BIBLIO_STATE.tipo
      ? lista.filter((r) => String(r.tipo || "").trim() === BIBLIO_STATE.tipo)
      : lista;
    if (!filtered.length) {
      grid.innerHTML = `<div class="biblioEmpty"><h2>Sin resultados</h2><p>Prueba con otra búsqueda o quita los filtros.</p></div>`;
      if (moreWrap) moreWrap.hidden = true;
      return 0;
    }
    grid.classList.remove("biblioGridFolders");
    grid.innerHTML = filtered.slice(0, BIBLIO_STATE.shown).map(renderRecursoCard).join("");
    if (moreWrap) moreWrap.hidden = filtered.length <= BIBLIO_STATE.shown;
    return filtered.length;
  };

  const paint = () => {
    const grid = $("#biblioGrid", body);
    const moreWrap = $("#biblioMoreWrap", body);
    const meta = $(".biblioMeta", body);
    if (!grid) return;
    paintCrumbs();

    const scopeLabel = BIBLIO_STATE.navTema || BIBLIO_STATE.navArea || BIBLIO_STATE.navArte;
    const searchInput = $("#biblioSearch", body);
    if (searchInput) {
      searchInput.placeholder = scopeLabel
        ? `Buscar en ${scopeLabel}…`
        : "Buscar en toda la biblioteca…";
    }

    const term = normalizeText(BIBLIO_STATE.search);
    if (term) {
      // Búsqueda acotada a la carpeta actual: si estás dentro de un arte/área/tema,
      // solo busca ahí. En "Inicio" busca en toda la biblioteca visible.
      let source = visibles;
      if (BIBLIO_STATE.navArte) {
        source = source.filter((r) => {
          const macro = macroForRecurso(r);
          return (macro === "*" ? "General" : macro) === BIBLIO_STATE.navArte;
        });
      }
      if (BIBLIO_STATE.navArea) {
        source = source.filter((r) => (String(r.area || "").trim() || "General") === BIBLIO_STATE.navArea);
      }
      if (BIBLIO_STATE.navTema) {
        source = source.filter((r) => (String(r.tema || "").trim() || "Sin tema") === BIBLIO_STATE.navTema);
      }
      const minimumScore = bibliotecaMinimumSearchScore(term);
      const matches = source
        .map((r) => ({ recurso: r, score: bibliotecaSearchScore(r, term) }))
        .filter((item) => item.score >= minimumScore)
        .sort((a, b) => b.score - a.score || String(a.recurso.titulo || "").localeCompare(String(b.recurso.titulo || ""), "es"))
        .map((item) => item.recurso);
      const n = paintRecursos(matches, grid, moreWrap);
      const scope = BIBLIO_STATE.navTema || BIBLIO_STATE.navArea || BIBLIO_STATE.navArte;
      if (meta) meta.textContent = `${accessLabel} · ${n} resultado(s)${scope ? ` en ${scope}` : ""}`;
      return;
    }

    if (!BIBLIO_STATE.navArte) {
      // Nivel 1: carpetas de artes (áreas macro).
      grid.classList.add("biblioGridFolders");
      grid.innerHTML = arteNames.map((arte) => {
        const byArea = byArte.get(arte);
        return folderCard({ emoji: biblioAreaEmoji(arte), name: arte, count: arteCount(arte), sub: `${byArea.size} área(s)`, nav: `arte:${arte}` });
      }).join("");
      if (moreWrap) moreWrap.hidden = true;
      if (meta) meta.textContent = `${accessLabel} · ${arteNames.length} arte(s) · ${visibles.length} recurso(s)`;
    } else if (!BIBLIO_STATE.navArea) {
      // Nivel 2: carpetas de áreas dentro del arte.
      const byArea = byArte.get(BIBLIO_STATE.navArte);
      const areaNames = [...byArea.keys()].sort((a, b) => a.localeCompare(b, "es"));
      grid.classList.add("biblioGridFolders");
      grid.innerHTML = areaNames.map((a) => {
        const temas = byArea.get(a);
        const total = [...temas.values()].reduce((acc, arr) => acc + arr.length, 0);
        return folderCard({ emoji: biblioAreaEmoji(a), name: a, count: total, sub: `${temas.size} tema(s)`, nav: `area:${a}` });
      }).join("");
      if (moreWrap) moreWrap.hidden = true;
      if (meta) meta.textContent = `${accessLabel} · ${areaNames.length} área(s)`;
    } else if (!BIBLIO_STATE.navTema) {
      // Nivel 3: carpetas de temas dentro del área.
      const temas = byArte.get(BIBLIO_STATE.navArte).get(BIBLIO_STATE.navArea);
      const temaNames = [...temas.keys()].sort((a, b) => a.localeCompare(b, "es"));
      grid.classList.add("biblioGridFolders");
      grid.innerHTML = temaNames.map((t) =>
        folderCard({ emoji: "📂", name: t, count: temas.get(t).length, sub: "", nav: `tema:${t}` })
      ).join("");
      if (moreWrap) moreWrap.hidden = true;
      if (meta) meta.textContent = `${accessLabel} · ${temaNames.length} tema(s)`;
    } else {
      // Nivel 4: recursos del tema.
      const lista = byArte.get(BIBLIO_STATE.navArte).get(BIBLIO_STATE.navArea).get(BIBLIO_STATE.navTema) || [];
      const n = paintRecursos(lista, grid, moreWrap);
      if (meta) meta.textContent = `${accessLabel} · ${n} recurso(s)`;
    }

    grid.querySelectorAll("[data-nav]").forEach((b) => {
      b.addEventListener("click", () => {
        const [kind, ...rest] = b.dataset.nav.split(":");
        const value = rest.join(":");
        if (kind === "arte") BIBLIO_STATE.navArte = value;
        else if (kind === "area") BIBLIO_STATE.navArea = value;
        else BIBLIO_STATE.navTema = value;
        BIBLIO_STATE.shown = 60;
        paint();
      });
    });
  };

  $("#biblioSearch", body)?.addEventListener("input", (e) => {
    BIBLIO_STATE.search = e.target.value;
    BIBLIO_STATE.shown = 60;
    paint();
  });
  $("#biblioTipo", body)?.addEventListener("change", (e) => {
    BIBLIO_STATE.tipo = e.target.value;
    BIBLIO_STATE.shown = 60;
    paint();
  });
  $("#biblioMoreBtn", body)?.addEventListener("click", () => {
    BIBLIO_STATE.shown += 60;
    paint();
  });

  paint();
}

// Icono y etiqueta según el tipo de adjunto, para que se entienda qué se abre.
function biblioLinkKind(url, titulo) {
  const u = normalizeText(url);
  const t = normalizeText(titulo);
  if (u.includes(".pdf") || t.includes(".pdf") || t.includes("pdf")) return { icon: "📄", kind: "PDF" };
  if (u.includes("youtube.") || u.includes("youtu.be") || u.includes("vimeo.")) return { icon: "▶️", kind: "Video" };
  if (/\.(mp3|wav|m4a|ogg)\b/.test(u)) return { icon: "🎧", kind: "Audio" };
  if (/\.(png|jpe?g|gif|webp)\b/.test(u)) return { icon: "🖼️", kind: "Imagen" };
  if (u.includes("classroom.google")) return { icon: "🎓", kind: "Classroom" };
  if (u.includes("docs.google") || /\.(docx?|odt)\b/.test(u)) return { icon: "📝", kind: "Documento" };
  if (u.includes("drive.google")) return { icon: "📁", kind: "Archivo" };
  return { icon: "🌐", kind: "Enlace" };
}

function renderRecursoCard(recurso) {
  const enlaces = Array.isArray(recurso.enlaces) ? recurso.enlaces : [];
  const etiquetas = Array.isArray(recurso.etiquetas) ? recurso.etiquetas : [];
  const linksHtml = enlaces
    .filter((l) => l && l.url)
    .map((l, i) => {
      const safeUrl = String(l.url || "");
      if (!/^https?:\/\//i.test(safeUrl)) return "";
      const label = String(l.titulo || "").trim() || `Recurso ${i + 1}`;
      const { icon, kind } = biblioLinkKind(safeUrl, label);
      return `
        <a class="biblioLinkBtn" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}">
          <span class="biblioLinkIcon">${icon}</span>
          <span class="biblioLinkInfo">
            <span class="biblioLinkKind">${kind}</span>
            <span class="biblioLinkName">${escapeHtml(label)}</span>
          </span>
          <span class="biblioLinkOpen">Abrir ↗</span>
        </a>
      `;
    })
    .join("");

  return `
    <article class="biblioCard" style="--areaHue:${biblioAreaHue(recurso.area)}">
      <div class="biblioCardTop">
        <span class="biblioArea">${biblioAreaEmoji(recurso.area)} ${escapeHtml(recurso.area || "general")}</span>
        ${recurso.tipo ? `<span class="biblioTipo">${escapeHtml(recurso.tipo)}</span>` : ""}
      </div>
      <h3 class="biblioTitle">${escapeHtml(recurso.titulo || "Sin título")}</h3>
      ${recurso.tema ? `<p class="biblioTema">📂 ${escapeHtml(recurso.tema)}</p>` : ""}
      ${recurso.descripcion ? `<p class="biblioDesc">${escapeHtml(String(recurso.descripcion).slice(0, 220))}</p>` : ""}
      ${etiquetas.length ? `<div class="biblioTags">${etiquetas.slice(0, 6).map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      ${linksHtml ? `<div class="biblioLinks">${linksHtml}</div>` : ""}
    </article>
  `;
}

/* ============================================================================
   12) AUTH
============================================================================ */
let loginInFlight = false;

function friendlyAuthError(code = "") {
  if (code === "auth/unauthorized-domain") return "Dominio no autorizado en Firebase Auth.";
  if (code === "auth/popup-blocked") return "El navegador bloqueó la ventana de inicio de sesión.";
  if (code === "auth/cancelled-popup-request") return "Se canceló el intento de inicio de sesión.";
  if (code === "auth/popup-closed-by-user") return "Cerraste la ventana de inicio de sesión.";
  if (code === "auth/network-request-failed") return "Falló la red. Revisa internet.";
  if (code === "auth/internal-error") return "Hubo un error interno de autenticación.";
  return "";
}

async function ensureAuthPersistence(auth) {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return true;
  } catch (error) {
    console.warn("No se pudo setPersistence:", error);
    return false;
  }
}

async function doGoogleLogin(auth) {
  if (loginInFlight) return;

  const btnGoogle = $("#btn-google");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  loginInFlight = true;
  setButtonBusy(btnGoogle, true, "Entrando...");

  try {
    await ensureAuthPersistence(auth);

    if (isStandalone()) {
      toast("Abriendo Google para iniciar sesión…");
    }

    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = error?.code || "";

    if (code === "auth/popup-closed-by-user") return;

    const friendly = friendlyAuthError(code);

    if (code === "auth/popup-blocked" && isStandalone()) {
      toast("La app instalada bloqueó la ventana de Google. Ahí toca resolver eso aparte 😵‍💫");
    } else {
      toast(friendly ? `No se pudo iniciar sesión: ${friendly}` : "No se pudo iniciar sesión");
    }

    console.error("Login error:", error);
  } finally {
    loginInFlight = false;
    setButtonBusy(btnGoogle, false);
  }
}

async function doLogout(auth) {
  try {
    closeDrawer();
    await signOut(auth);
  } catch (error) {
    toast("No se pudo cerrar sesión");
    console.error("Logout error:", error);
  }
}

/* ============================================================================
   13) APP BOOT
============================================================================ */
function setUserLine(profile, user) {
  const userLine = $("#user-line");
  if (!userLine) return;
  userLine.textContent = profile?.label || prettyName(user, emailKey(user));
}

// Resuelve si un usuario puede entrar al HUB. Fuente de verdad: colección
// Firestore "hubUsers" (gestionable desde el panel admin). Si no hay doc o las
// reglas aún no están publicadas, cae a la lista base del código (HUB.USERS).
async function resolveHubAccess(user) {
  const email = emailKey(user);
  if (isAdminUser(user)) return { allowed: true, managed: null };

  let managed = null;
  try {
    const snap = await getDoc(doc(APP_STATE.db, "hubUsers", email));
    if (snap.exists()) managed = snap.data();
  } catch (_) {
    // Reglas no publicadas todavía o sin permiso: usamos la lista base.
  }

  if (managed) {
    const enabled = managed.enabled !== false;
    const expired = isAccessExpired(managed.accessExpiresAt);
    return { allowed: enabled && !expired, managed, expired: enabled && expired };
  }
  return { allowed: !!HUB.USERS?.[email], managed: null };
}

async function handleAuthorizedUser(user, managed = null) {
  const email = emailKey(user);
  const baseProfile = HUB.USERS?.[email] || null;
  const profile = baseProfile || (managed
    ? { label: managed.label || managed.name || email }
    : null);
  // Inyecta los botones personalizados (Firestore) antes de resolver links.
  await loadCustomButtons();
  const mergedLinks = buildLinksForUser(email);

  APP_STATE.activeUser = user;
  APP_STATE.activeProfile = profile;
  APP_STATE.activeLinks = mergedLinks;
  APP_STATE.hubUserDoc = managed;

  // Los admins no pasan por resolveHubAccess con lectura del doc; lo traemos
  // aparte por si también tienen áreas configuradas (no es obligatorio).
  if (!managed) {
    try {
      const snap = await getDoc(doc(APP_STATE.db, "hubUsers", email));
      if (snap.exists()) APP_STATE.hubUserDoc = snap.data();
    } catch (_) { /* sin doc o sin permiso: queda null */ }
  }

  setUserLine(profile, user);
  setDrawerProfile(profile, user);

  /* Pintamos el Hub antes de las lecturas auxiliares. Así una red inestable,
     una regla recién actualizada o una sesión restaurada no puede dejarlo en
     blanco al volver a abrir la app. */
  show("app");
  renderButtons(HUB.BUTTONS, mergedLinks, profile);
  startStudentMessagesBadge();
  const backgroundLoads = [
    autoCloseStaleOpenShifts({ includeAll: isAdminUser(user), silent: true }),
    loadTeacherScheduleForActiveUser(),
    loadCalendarUpdatesForActiveUser(),
    refreshTeacherJornadaStatus()
  ];
  Promise.allSettled(backgroundLoads).then((results) => {
    results.filter((result) => result.status === "rejected").forEach((result) =>
      console.warn("No se pudo completar una carga auxiliar del Hub:", result.reason)
    );
  });
}

async function handleUnauthorizedUser(auth, reason = "") {
  toast(reason === "expired"
    ? "Tu acceso temporal venció. Pídele a coordinación que lo renueve 🗓️"
    : "Tu correo no está autorizado para este hub 🫠");

  try {
    await signOut(auth);
  } catch (_) {}

  APP_STATE.activeUser = null;
  APP_STATE.activeProfile = null;
  APP_STATE.activeLinks = {};
  APP_STATE.teacherSchedule = { loading: false, schedule: null, overrides: {} };

  show("login");
  closeDrawer();
}

async function mount() {
  try {
    document.title = "Musicala Docentes Hub";
  } catch (_) {}

  if (!assertConfig(firebaseConfig)) {
    show("login");
    toast("Falta configurar Firebase en app.js");
    return;
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  APP_STATE.db = db;
  wireTeacherShiftAutoCloseWatchers();

  await ensureAuthPersistence(auth);

  $("#btn-google")?.addEventListener("click", () => doGoogleLogin(auth));
  $("#btn-logout")?.addEventListener("click", () => doLogout(auth));

  wireDrawerHandlers(auth);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      APP_STATE.activeUser = null;
      APP_STATE.activeProfile = null;
      APP_STATE.activeLinks = {};
      APP_STATE.teacherSchedule = { loading: false, schedule: null, overrides: {} };

      show("login");
      closeDrawer();
      return;
    }

    try {
      const access = await resolveHubAccess(user);
      if (!access.allowed) {
        await handleUnauthorizedUser(auth, access.expired ? "expired" : "");
        return;
      }

      await handleAuthorizedUser(user, access.managed);
      flushPendingShifts();
    } catch (error) {
      console.error("No se pudo restaurar el Hub:", error);
      show("login");
      toast("No pudimos restaurar la sesión. Intenta entrar de nuevo.");
    }
  });
}

/* ============================================================================
   14) INIT
============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  console.log("BUILD", BUILD);
  setupBrowserUiOffset();
  registerServiceWorker();
  setupInstallPrompt();
  wireUpdateBanner();
  mount();
});
