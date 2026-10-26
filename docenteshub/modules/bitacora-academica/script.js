/* Musicala · Bitácora Académica / Trabajo por Objetivos — módulo del HUB
   ============================================================================
   PERSISTENCIA: 100% Firebase/Firestore (ya no usa Google Sheets ni localStorage).
   - El módulo corre dentro del HUB (iframe, mismo origen) y reutiliza la sesión
     de Firebase Auth ya iniciada. No requiere volver a iniciar sesión.
   - Cada docente lee/escribe SOLO su información (reglas de Firestore por correo).
     La coordinación (admin) puede ver todo.

   Colecciones Firestore:
     academicObjectives    → tareas / objetivos
     academicTaskBudgets   → bolsas de horas
     academicTaskHourLogs  → registros de horas (avances)

   El "Volver al HUB" avisa a la ventana padre (postMessage) para cerrar.
============================================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/* Mismo proyecto que el HUB (config pública del cliente). */
const firebaseConfig = {
  apiKey: "AIzaSyC06dLl2Lig3-kD4OVmh4C9LpFW9AeTyOc",
  authDomain: "musicala-docentes-hub.firebaseapp.com",
  projectId: "musicala-docentes-hub",
  storageBucket: "musicala-docentes-hub.firebasestorage.app",
  messagingSenderId: "936379833270",
  appId: "1:936379833270:web:512519cf318c919e3abf17"
};

const COL = {
  objectives: "academicObjectives",
  budgets: "academicTaskBudgets",
  hourLogs: "academicTaskHourLogs",
  hubUsers: "hubUsers"
};

const ADMIN_EMAILS = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
  "musicalaasesor@gmail.com",
  "adminmusicala@gmail.com"
];

// Base local para que el módulo funcione aunque todavía no existan docs en hubUsers.
// Los docentes nuevos agregados desde el panel se suman desde Firestore.
const BASE_TEACHERS = {
  "emilybg0102@gmail.com": "Emily Bejarano",
  "annitolad@gmail.com": "Angie Nitola",
  "lorenaduarte.404@gmail.com": "Laura Sánchez",
  "malego2709@gmail.com": "María Alejandra Gómez",
  "bagutierrezm@gmail.com": "Brian Alexander Gutiérrez",
  "darasaxcifuentes@gmail.com": "Dara Natalia Cifuentes Rojas",
  "alekcaballeromusic@gmail.com": "Alek Caballero",
  "catalina.medina.leal@gmail.com": "Catalina Medina"
};

/* ------------------------------ Utilidades ------------------------------ */
const $ = (selector, ctx = document) => ctx.querySelector(selector);
const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const toNumber = value => {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
// Muestra las horas en formato legible "X h Y min" para evitar confusiones
// con los decimales (p. ej. 4,25 h → "4 h 15 min").
const fmtHours = n => {
  const sign = Number(n) < 0 ? '-' : '';
  const totalMin = Math.round(Math.abs(Number(n) || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  let body;
  if (h && m) body = `${h} h ${m} min`;
  else if (h) body = `${h} h`;
  else body = `${m} min`;
  return `${sign}${body}`;
};
const todayMonth = () => new Date().toISOString().slice(0, 7);
const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
const debounce = (fn, delay = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/* Contexto inyectado por el HUB (?email=&name=&role=&embedded=1). */
const ACADEMIC_CTX = { email: '', name: '', role: 'Docente', embedded: false };

let DB = null;
let AUTH = null;
let STORAGE = null;
let ME = '';        // correo autenticado (fuente de verdad para escribir)
let currentTask = null;
let activeView = 'resumen';
let dataReady = false;
let teacherDirectory = [];

const store = {
  objectives: [],
  budgets: [],
  hourLogs: []
};

function isAdminContext() {
  return ACADEMIC_CTX.role === 'Admin' && ADMIN_EMAILS.includes(ME);
}

function readContextFromUrl() {
  const p = new URL(location.href).searchParams;
  ACADEMIC_CTX.email = String(p.get('email') || '').toLowerCase().trim();
  ACADEMIC_CTX.name = String(p.get('name') || '').trim();
  ACADEMIC_CTX.role = String(p.get('role') || '').trim().toLowerCase() === 'admin' ? 'Admin' : 'Docente';
  ACADEMIC_CTX.embedded = p.get('embedded') === '1' || window.parent !== window;
}

function setStatus(message, isError = false) {
  const el = $('#status');
  if (!el) return;
  el.textContent = message;
  el.className = isError ? 'status status--error' : 'status';
}

function inferPerson() {
  return ACADEMIC_CTX.name || ME || '';
}

function applyBranding() {
  document.title = `Bitácora Académica · ${ACADEMIC_CTX.name || 'Musicala'}`;
  const ctx = $('#site-context');
  if (ctx) {
    ctx.textContent = `${ACADEMIC_CTX.name || ME}${(ACADEMIC_CTX.name || ME) ? ' · ' : ''}${isAdminContext() ? 'Vista coordinación (todas las docentes)' : 'Tu bitácora académica'}`;
    ctx.hidden = false;
  }
}


function buildBaseTeacherDirectory() {
  return Object.entries(BASE_TEACHERS).map(([email, label]) => ({
    email,
    label,
    enabled: true,
    isAdmin: ADMIN_EMAILS.includes(email),
    source: 'base'
  }));
}

async function loadTeacherDirectory() {
  if (!isAdminContext()) {
    teacherDirectory = [{ email: ME, label: ACADEMIC_CTX.name || ME, enabled: true, isAdmin: false, source: 'self' }];
    return teacherDirectory;
  }

  const map = new Map();
  for (const item of buildBaseTeacherDirectory()) map.set(item.email, item);

  try {
    const snap = await getDocs(collection(DB, COL.hubUsers));
    snap.forEach((d) => {
      const data = d.data() || {};
      const email = String(d.id || data.email || '').toLowerCase().trim();
      if (!email) return;
      map.set(email, {
        email,
        label: data.label || data.name || map.get(email)?.label || email,
        enabled: data.enabled !== false,
        isAdmin: ADMIN_EMAILS.includes(email),
        source: 'panel'
      });
    });
  } catch (error) {
    console.warn('No se pudo cargar hubUsers para asignación académica', error);
  }

  teacherDirectory = Array.from(map.values())
    .filter(item => item.enabled && !item.isAdmin)
    .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  return teacherDirectory;
}

function getTeacherFromDirectory(emailOrName = '') {
  const value = String(emailOrName || '').toLowerCase().trim();
  return teacherDirectory.find(t => t.email === value)
    || teacherDirectory.find(t => norm(t.label) === norm(emailOrName))
    || null;
}

function teacherOptionsHtml(selectedEmail = '') {
  const selected = String(selectedEmail || '').toLowerCase();
  return teacherDirectory.map(t => `<option value="${esc(t.email)}" ${t.email === selected ? 'selected' : ''}>${esc(t.label)} · ${esc(t.email)}</option>`).join('');
}

function fillTeacherSelect(select, selectedEmail = '') {
  if (!select) return;
  if (!isAdminContext()) {
    select.innerHTML = `<option value="${esc(ME)}">${esc(ACADEMIC_CTX.name || ME)}</option>`;
    select.value = ME;
    select.closest('label')?.setAttribute('hidden', '');
    return;
  }
  select.closest('label')?.removeAttribute('hidden');
  select.innerHTML = `<option value="">Selecciona docente</option>${teacherOptionsHtml(selectedEmail)}`;
  if (selectedEmail && Array.from(select.options).some(o => o.value === selectedEmail)) select.value = selectedEmail;
}

function selectedTeacherFor(kind = 'objective') {
  if (!isAdminContext()) return { email: ME, label: ACADEMIC_CTX.name || ME };
  const id = kind === 'budget' ? '#budgetTeacherEmail' : '#objTeacherEmail';
  const select = $(id);
  const email = String(select?.value || '').toLowerCase().trim();
  const found = getTeacherFromDirectory(email);
  return found ? { email: found.email, label: found.label } : { email: '', label: '' };
}

function normalizeWorkScope(value, estimatedHours = 0) {
  const s = norm(value);
  if (s.includes('bolsa') || s.includes('objetivo') || s.includes('extra')) return 'bolsa';
  if (s.includes('academ') || s.includes('jornada') || s.includes('pendiente')) return 'academica';
  // Compatibilidad con registros anteriores: si tenían horas estimadas, probablemente eran de bolsa.
  return toNumber(estimatedHours) > 0 ? 'bolsa' : 'academica';
}

function workScopeLabel(scope) {
  return normalizeWorkScope(scope) === 'bolsa' ? 'Bolsa de horas' : 'Tarea académica';
}

function workScopeClass(scope) {
  return normalizeWorkScope(scope) === 'bolsa' ? 'pill pill--warn' : 'pill pill--neutral';
}

/* Ámbito de un REGISTRO de avance: 'jornada' (no cuenta a la bolsa) o 'bolsa'
   (trabajo remoto que repone horas pendientes). Es la etiqueta clave del modelo:
   la misma tarea puede tener avances de jornada y avances de bolsa. */
function logScopeOf(log) {
  if (log && log.logScope) return norm(log.logScope).includes('bolsa') ? 'bolsa' : 'jornada';
  // Compatibilidad con registros anteriores (cuando el ámbito vivía en la tarea):
  const task = store.objectives.find(item => String(item.id) === String(log?.taskId));
  return task && normalizeWorkScope(task.workScope, task.estimatedHours) === 'bolsa' ? 'bolsa' : 'jornada';
}

function logScopeLabel(scope) {
  return scope === 'bolsa' ? 'Bolsa de horas' : 'Jornada';
}

function logScopeClass(scope) {
  return scope === 'bolsa' ? 'pill pill--warn' : 'pill pill--neutral';
}

/* ----------------------- Fechas y rangos de bolsa ---------------------- */
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const dateOnly = value => String(value || '').slice(0, 10);
function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00`);
  const b = new Date(`${toISO}T00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / 86400000);
}
function addDaysISO(iso, days) {
  const date = new Date(`${dateOnly(iso)}T12:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + (Number(days) || 0));
  return date.toLocaleDateString('en-CA');
}
function budgetToleranceDays(budget) {
  const value = Number(budget?.toleranceDays);
  return Number.isFinite(value) ? Math.max(0, value) : 7;
}
/* Días en que la docente puede adelantar trabajo ANTES de la fecha de inicio. */
function budgetLeadDays(budget) {
  const value = Number(budget?.leadDays);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
function budgetEffectiveStart(budget) {
  const start = dateOnly(budget?.startDate);
  return start ? addDaysISO(start, -budgetLeadDays(budget)) : '';
}
function budgetEffectiveEnd(budget) {
  const end = dateOnly(budget?.endDate);
  return end ? addDaysISO(end, budgetToleranceDays(budget)) : '';
}
function fmtShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${dateOnly(iso)}T00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
function fmtBudgetRange(budget) {
  const start = dateOnly(budget.startDate);
  const end = dateOnly(budget.endDate);
  if (start && end) {
    const year = new Date(`${end}T00:00`).getFullYear();
    return `${fmtShortDate(start)} – ${fmtShortDate(end)} ${year}`;
  }
  // Compatibilidad con bolsas viejas que solo tenían periodo (mes).
  return budget.period || 'Sin fechas';
}

/* ¿Este avance de bolsa cae dentro del rango de esta bolsa y es del mismo docente? */
function logBelongsToBudget(log, budget) {
  if (logScopeOf(log) !== 'bolsa') return false;
  const budgetEmail = String(budget.teacherEmail || '').toLowerCase();
  const sameTeacher = budgetEmail
    ? String(log.teacherEmail || '').toLowerCase() === budgetEmail
    : norm(log.person) === norm(budget.person);
  if (!sameTeacher) return false;
  if (log.budgetId) return String(log.budgetId) === String(budget.id);
  const start = budgetEffectiveStart(budget);
  const end = dateOnly(budget.endDate);
  const when = dateOnly(log.start);
  if (start && when < start) return false;
  if (end && when > end) return false;
  // Bolsa vieja sin rango: caer al periodo (mes).
  if (!start && !end && budget.period && String(log.period || '') !== budget.period) return false;
  return true;
}

function budgetUsage(budget) {
  const used = store.hourLogs
    .filter(log => logBelongsToBudget(log, budget))
    .reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
  return { used: round2(used), remaining: round2(toNumber(budget.hours) - used) };
}

/* Una bolsa se considera cumplida si ya no le faltan horas o si coordinación
   la dio por hecha manualmente (p. ej. horas trabajadas fuera del rango por error). */
function isBudgetDone(budget, usage = budgetUsage(budget)) {
  return !!budget?.manualDone || usage.remaining <= 0;
}

function budgetStatus(budget) {
  const today = todayISO();
  const start = dateOnly(budget.startDate);
  const end = dateOnly(budget.endDate);
  if (start && today < start) {
    const effectiveStart = budgetEffectiveStart(budget);
    // Dentro de la ventana de anticipación: ya se puede adelantar trabajo.
    if (effectiveStart && today >= effectiveStart) {
      const d = daysBetween(today, start);
      return { label: `Anticipada · inicia en ${d} día${d === 1 ? '' : 's'}`, cls: 'pill pill--ok' };
    }
    const d = daysBetween(today, start);
    return { label: d === 1 ? 'Empieza mañana' : `Empieza en ${d} días`, cls: 'pill pill--neutral' };
  }
  const effectiveEnd = budgetEffectiveEnd(budget);
  if (effectiveEnd && today > effectiveEnd) return { label: 'Vencida', cls: 'pill pill--danger' };
  if (end && today > end) {
    const d = daysBetween(today, effectiveEnd);
    return { label: `En tolerancia · ${d} día${d === 1 ? '' : 's'}`, cls: 'pill pill--warn' };
  }
  if (end) {
    const d = daysBetween(today, end);
    if (d === 0) return { label: 'Vence hoy', cls: 'pill pill--warn' };
    return { label: `Vence en ${d} día${d === 1 ? '' : 's'}`, cls: d <= 2 ? 'pill pill--warn' : 'pill pill--ok' };
  }
  return { label: 'Activa', cls: 'pill pill--ok' };
}

/* Avances marcados como bolsa, filtrados por el responsable de la pestaña. */
function bolsaLogsInScope() {
  const person = $('#fBolsaPersona')?.value || '';
  return store.hourLogs.filter(log => {
    if (logScopeOf(log) !== 'bolsa') return false;
    if (person && String(log.person || '') !== person) return false;
    return true;
  });
}

/* Horas de bolsa registradas para una tarea concreta (respetando filtros de la bolsa). */
function bolsaUsedForTask(taskId, logs = bolsaLogsInScope()) {
  return logs
    .filter(log => String(log.taskId) === String(taskId))
    .reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
}

/* ============================ Carga de datos ============================ */
async function loadCollection(name) {
  // Docente: solo lo suyo. Admin: todo.
  let snap;
  if (isAdminContext()) {
    snap = await getDocs(collection(DB, name));
  } else {
    snap = await getDocs(query(collection(DB, name), where("teacherEmail", "==", ME)));
  }
  return snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
}

async function loadAll() {
  setStatus('Cargando…');
  const [objectives, budgets, hourLogs] = await Promise.all([
    loadCollection(COL.objectives),
    loadCollection(COL.budgets),
    loadCollection(COL.hourLogs)
  ]);
  store.objectives = objectives;
  store.budgets = budgets;
  store.hourLogs = hourLogs;
  dataReady = true;
  const n = store.objectives.length;
  setStatus(`${n} tarea${n === 1 ? '' : 's'} cargada${n === 1 ? '' : 's'}.`);
}

/* ----------------------------- Escrituras ------------------------------ */
function ownerFields(data = {}, existing = null) {
  const teacherEmail = String(
    data.teacherEmail || existing?.teacherEmail || (isAdminContext() ? '' : ME) || ME
  ).toLowerCase().trim();
  const teacher = getTeacherFromDirectory(teacherEmail);
  const teacherName = data.teacherName || data.person || existing?.teacherName || existing?.person || teacher?.label || ACADEMIC_CTX.name || teacherEmail || ME;

  return {
    teacherEmail,
    teacherName,
    person: data.person || existing?.person || teacherName,
    updatedAt: serverTimestamp(),
    updatedBy: ME,
    createdBy: existing?.createdBy || data.createdBy || ME
  };
}

async function dbSaveObjective(obj) {
  const existing = store.objectives.find(item => String(item.id) === String(obj.id)) || null;
  const owner = ownerFields(obj, existing);
  if (!owner.teacherEmail) throw new Error('Selecciona una docente responsable.');
  const payload = {
    ...obj,
    workScope: normalizeWorkScope(obj.workScope ?? existing?.workScope, obj.estimatedHours ?? existing?.estimatedHours),
    ...owner
  };
  const ref = doc(DB, COL.objectives, obj.id);
  await setDoc(ref, payload, { merge: true });
}

async function dbDeleteObjective(id) {
  await deleteDoc(doc(DB, COL.objectives, id));
}

async function dbSaveBudget(budget) {
  const existing = store.budgets.find(item => String(item.id) === String(budget.id)) || null;
  const owner = ownerFields(budget, existing);
  if (!owner.teacherEmail) throw new Error('Selecciona una docente para la bolsa.');
  const ref = doc(DB, COL.budgets, budget.id);
  await setDoc(ref, { ...budget, ...owner, workScope: 'bolsa' }, { merge: true });
}

async function dbSaveHourLog(log) {
  const task = store.objectives.find(item => String(item.id) === String(log.taskId)) || null;
  const owner = ownerFields(log, task);
  const ref = doc(DB, COL.hourLogs, log.id);
  await setDoc(ref, { ...log, ...owner }, { merge: true });
}

/* ============================ Modelo de tareas ========================== */
function normalizeState(value) {
  const s = norm(value);
  if (!s) return 'Pendiente';
  if (s.includes('cancel') || s.includes('anulad') || s.includes('descart')) return 'Cancelado';
  if (s.includes('paus')) return 'Pausado';
  if (s.startsWith('cumpl') || s.includes('termin') || s.includes('hecha') || s.includes('finaliz') || s.includes('aprob')) return 'Cumplido';
  if (s.includes('curso') || s.includes('progreso') || s.includes('desarrollo')) return 'En curso';
  return 'Pendiente';
}

function stateClass(value) {
  const state = normalizeState(value);
  if (state === 'Cancelado') return 'pill pill--danger';
  if (state === 'Pausado') return 'pill pill--neutral';
  if (state === 'Cumplido') return 'pill pill--ok';
  if (state === 'En curso') return 'pill pill--warn';
  return 'pill pill--neutral';
}

function urgencyClass(value) {
  const s = norm(value);
  if (s.includes('alta') || s.includes('urgente')) return 'pill pill--danger';
  if (s.includes('media')) return 'pill pill--warn';
  if (s.includes('baja')) return 'pill pill--ok';
  return 'pill pill--neutral';
}

function getAllTasks() {
  return store.objectives.map(task => ({
    source: 'firestore',
    id: task.id,
    title: task.title || 'Tarea sin título',
    teacherEmail: String(task.teacherEmail || '').toLowerCase(),
    teacherName: task.teacherName || task.person || inferPerson(),
    person: task.person || task.teacherName || inferPerson(),
    workScope: normalizeWorkScope(task.workScope, task.estimatedHours),
    state: task.state || 'Pendiente',
    urgency: task.urgency || '',
    dueDate: task.dueDate || '',
    estimatedHours: toNumber(task.estimatedHours),
    period: task.period || todayMonth(),
    category: task.category || '',
    criteria: task.criteria || task.description || '',
    description: task.description || '',
    createdAt: task.createdAt || '',
    updatedAt: task.updatedAt || '',
    updatedBy: task.updatedBy || '',
    adminManagementNote: task.adminManagementNote || ''
  }));
}

function getTaskById(id) {
  return getAllTasks().find(task => String(task.id) === String(id));
}

function durationHours(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
  return round2((b - a) / 36e5);
}

function usedHoursForTask(taskId) {
  return store.hourLogs
    .filter(log => String(log.taskId) === String(taskId))
    .reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
}

function getSelectedObjectiveTasks() {
  // Las tareas de la bolsa son aquellas con al menos un avance marcado como
  // "bolsa" dentro del periodo/responsable filtrado (modelo por registro).
  const queryStr = norm($('#qBolsa')?.value || '');
  const logs = bolsaLogsInScope();
  const taskIds = new Set(logs.map(log => String(log.taskId)));
  return getAllTasks().filter(task => {
    if (!taskIds.has(String(task.id))) return false;
    if (queryStr && !norm(`${task.id} ${task.title} ${task.person} ${task.category} ${task.description}`).includes(queryStr)) return false;
    return true;
  });
}

/* ============================== Render ================================= */
function emptyRow(colspan = 8, text = 'No hay información para mostrar todavía.') {
  return `<tr><td colspan="${colspan}" class="empty-state">${esc(text)}</td></tr>`;
}

function renderTabs() {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === activeView));
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${activeView}`));
}

function switchView(viewName) {
  activeView = viewName;
  renderTabs();
  renderAll();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function fillSelect(select, options, placeholder) {
  if (!select) return;
  const prev = select.value;
  select.innerHTML = `<option value="">${esc(placeholder)}</option>` + options.map(option => `<option value="${esc(option)}">${esc(option)}</option>`).join('');
  if (prev && options.includes(prev)) select.value = prev;
  select.style.display = options.length ? '' : 'none';
}

function fillFilters() {
  const tasks = getAllTasks();
  fillSelect($('#fPersona'), uniqueSorted(tasks.map(t => t.person)), 'Responsable: todos');
  fillSelect($('#fEstado'), uniqueSorted(tasks.map(t => normalizeState(t.state))), 'Estado: todos');
  fillSelect($('#fUrgencia'), uniqueSorted(tasks.map(t => t.urgency)), 'Urgencia: todas');
  fillSelect($('#fBolsaPersona'), uniqueSorted(tasks.map(t => t.person).concat(store.budgets.map(b => b.person))), 'Responsable: todos');
}

function filteredTaskRows() {
  const tasks = getAllTasks();
  const selPerson = $('#fPersona')?.value || '';
  const selState = $('#fEstado')?.value || '';
  const selUrgency = $('#fUrgencia')?.value || '';
  const queryStr = norm($('#q')?.value || '');
  return tasks.filter(task => {
    if (selPerson && task.person !== selPerson) return false;
    if (selState && normalizeState(task.state) !== selState) return false;
    if (selUrgency && task.urgency !== selUrgency) return false;
    if (queryStr && !norm(`${task.id} ${task.title} ${task.person} ${task.state} ${task.urgency} ${task.dueDate} ${task.description}`).includes(queryStr)) return false;
    return true;
  })
  // Lo que se movió hace poco queda arriba: así se ve dónde están agregando.
  .sort((a, b) => {
    const ma = Number.isFinite(lastActivity(a).millis) ? lastActivity(a).millis : 0;
    const mb = Number.isFinite(lastActivity(b).millis) ? lastActivity(b).millis : 0;
    return mb - ma;
  });
}

function renderMainTable() {
  const thead = $('#tbl thead');
  const tbody = $('#tbl tbody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr><th>Tarea agregada</th><th>Última actualización</th><th>Tarea</th><th>Responsable</th><th>Periodo</th><th>Estado</th><th>Horas</th><th>Acciones</th></tr>';
  const rows = filteredTaskRows();

  if (!rows.length) {
    tbody.innerHTML = emptyRow(8, dataReady
      ? 'No hay tareas con esos filtros. Crea una con “＋ Asignar tarea”.'
      : 'Cargando…');
    return;
  }

  tbody.innerHTML = rows.map(task => {
    const used = usedHoursForTask(task.id);
    const hoursHtml = toNumber(task.estimatedHours) > 0
      ? `<div class="hours-cell"><strong>${fmtHours(used)}</strong><small>de ${fmtHours(task.estimatedHours)} est.</small></div>`
      : `<div class="hours-cell"><strong>${fmtHours(used)}</strong><small>registradas</small></div>`;
    return `
      <tr data-id="${esc(task.id)}">
        <td data-th="Tarea agregada"><span class="mono">${esc(formatCreatedAt(task))}</span></td>
        <td data-th="Última actualización">${lastActivityCell(task)}</td>
        <td data-th="Tarea" class="wrap"><strong>${esc(task.title)}</strong><small>${esc(task.description || task.criteria || '')}</small></td>
        <td data-th="Responsable">${esc(task.person || '—')}</td>
        <td data-th="Periodo">${esc(task.period || '—')}</td>
        <td data-th="Estado"><span class="${stateClass(task.state)}">${esc(normalizeState(task.state))}</span></td>
        <td data-th="Horas">${hoursHtml}</td>
        <td data-th="Acciones"><button class="btn btn-dark btn-detail" data-id="${esc(task.id)}" type="button">📝 Abrir</button></td>
      </tr>
    `;
  }).join('');
}

function countStates(tasks) {
  return tasks.reduce((acc, task) => {
    acc[normalizeState(task.state)] = (acc[normalizeState(task.state)] || 0) + 1;
    return acc;
  }, { Pendiente: 0, 'En curso': 0, Cumplido: 0 });
}

function renderMetrics() {
  const tasks = getAllTasks();
  const states = countStates(tasks);
  const estimated = tasks.reduce((sum, task) => sum + toNumber(task.estimatedHours), 0);
  const used = store.hourLogs.reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);

  $('#mPend').textContent = states.Pendiente || 0;
  $('#mCurso').textContent = states['En curso'] || 0;
  $('#mComp').textContent = states.Cumplido || 0;
  $('#mEstimadas').textContent = fmtHours(estimated);
  $('#mUsadas').textContent = fmtHours(used);
}

function renderInsights() {
  const box = $('#insights');
  if (!box) return;
  const tasks = getAllTasks();
  const withoutEstimate = tasks.filter(task => toNumber(task.estimatedHours) <= 0);
  const overBudgetTasks = tasks.filter(task => toNumber(task.estimatedHours) > 0 && usedHoursForTask(task.id) > toNumber(task.estimatedHours));
  const pending = tasks.filter(task => !['Cumplido', 'Pausado', 'Cancelado'].includes(normalizeState(task.state)));
  const used = store.hourLogs.reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
  const estimated = tasks.reduce((sum, task) => sum + toNumber(task.estimatedHours), 0);

  const items = [
    { title: 'Tareas activas', value: pending.length, text: pending.length ? 'Tienes trabajo pendiente o en curso.' : 'No hay tareas activas registradas.' },
    { title: 'Sin horas estimadas', value: withoutEstimate.length, text: withoutEstimate.length ? 'Hay tareas sin horas estimadas todavía.' : 'Todas las tareas tienen horas estimadas.' },
    { title: 'Horas usadas vs. estimadas', value: `${fmtHours(used)} / ${fmtHours(estimated)}`, text: used > estimated && estimated > 0 ? 'Las horas registradas superan lo estimado.' : 'Las horas registradas están dentro de lo estimado.' },
    { title: 'Tareas sobre lo estimado', value: overBudgetTasks.length, text: overBudgetTasks.length ? 'Hay tareas que superaron sus horas estimadas.' : 'Ninguna tarea superó sus horas estimadas.' }
  ];

  box.innerHTML = items.map(item => `
    <div class="insight-card">
      <span>${esc(item.title)}</span>
      <strong>${esc(item.value)}</strong>
      <p>${esc(item.text)}</p>
    </div>
  `).join('');
}

function renderNeedsEstimate() {
  const table = $('#tblNeedsEstimate');
  if (!table) return;
  const tasks = getAllTasks().filter(task => toNumber(task.estimatedHours) <= 0).slice(0, 10);
  table.querySelector('thead').innerHTML = '<tr><th>Tarea agregada</th><th>Tarea</th><th>Responsable</th><th>Estado</th><th>Acción</th></tr>';
  table.querySelector('tbody').innerHTML = tasks.length ? tasks.map(task => `
    <tr>
      <td data-th="Tarea agregada">${esc(formatCreatedAt(task))}</td>
      <td data-th="Tarea" class="wrap"><strong>${esc(task.title)}</strong></td>
      <td data-th="Responsable">${esc(task.person || '—')}</td>
      <td data-th="Estado"><span class="${stateClass(task.state)}">${esc(normalizeState(task.state))}</span></td>
      <td data-th="Acción"><button class="btn btn-soft btn-detail" data-id="${esc(task.id)}" type="button">Estimar</button></td>
    </tr>
  `).join('') : emptyRow(5, 'Todas las tareas tienen horas estimadas.');
}

function budgetTotals() {
  const selectedPerson = $('#fBolsaPersona')?.value || '';
  const tasks = getSelectedObjectiveTasks();
  const budgets = store.budgets.filter(budget => !selectedPerson || budget.person === selectedPerson);
  let budgetHours = 0;
  let used = 0;
  let remaining = 0;
  budgets.forEach(budget => {
    budgetHours += toNumber(budget.hours);
    const usage = budgetUsage(budget); // solo avances de bolsa dentro del rango
    used += usage.used;
    // Si coordinación la dio por cumplida, no queda saldo pendiente (pero el exceso sí se refleja).
    remaining += budget.manualDone ? Math.min(0, usage.remaining) : usage.remaining;
  });
  const estimated = tasks.reduce((sum, task) => sum + toNumber(task.estimatedHours), 0);
  return { budgetHours: round2(budgetHours), estimated, used: round2(used), remaining: round2(remaining), tasks, budgets };
}

function progressBar(value, max) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const label = `${round2(percent)}%`;
  return `<div class="progress" aria-label="${esc(label)}"><span style="width:${percent}%"></span></div>`;
}

function renderBudgetSummary() {
  const summary = $('#budgetSummary');
  const balance = $('#hourBalance');
  if (!summary || !balance) return;
  const totals = budgetTotals();
  const hasBudget = totals.budgetHours > 0;
  const over = hasBudget && totals.used > totals.budgetHours;

  summary.innerHTML = `
    <div class="budget-kpis">
      <div><span>Bolsa asignada</span><strong>${fmtHours(totals.budgetHours)}</strong></div>
      <div><span>Planeado</span><strong>${fmtHours(totals.estimated)}</strong></div>
      <div><span>Usado</span><strong>${fmtHours(totals.used)}</strong></div>
      <div><span>Saldo</span><strong class="${over ? 'danger-text' : ''}">${fmtHours(totals.remaining)}</strong></div>
    </div>
    ${progressBar(totals.used, totals.budgetHours || totals.estimated || 1)}
    <p class="helper-text">${hasBudget ? (over ? 'Se registraron más horas de las asignadas a la bolsa.' : 'La bolsa todavía tiene horas por cumplir.') : 'Aún no hay una bolsa de horas asignada.'}</p>
  `;

  const sortedBudgets = [...totals.budgets].sort((a, b) => String(b.startDate || b.period || '').localeCompare(String(a.startDate || a.period || '')));
  balance.innerHTML = sortedBudgets.length ? sortedBudgets.map(budget => {
    const usage = budgetUsage(budget);
    const st = budgetStatus(budget);
    const done = isBudgetDone(budget, usage);
    const manualOnly = !!budget.manualDone && usage.remaining > 0;
    const doneLabel = manualOnly ? 'Cumplida (ajuste)' : 'Cumplida';
    const faltanCls = done ? '' : (st.label === 'Vencida' ? 'danger-text' : '');
    const pendingLeft = budget.manualDone ? 0 : Math.max(0, usage.remaining);
    return `
    <div class="balance-card">
      <div class="balance-card__head">
        <strong>${esc(budget.person)}</strong>
        <span class="${done ? 'pill pill--ok' : st.cls}">${esc(done ? doneLabel : st.label)}</span>
      </div>
      <small class="balance-card__range">📅 ${esc(fmtBudgetRange(budget))} · ${esc(budget.note || 'Sin nota')}</small>
      ${budgetLeadDays(budget) > 0 ? `<small class="balance-card__range">Anticipación: ${budgetLeadDays(budget)} día${budgetLeadDays(budget) === 1 ? '' : 's'} · desde ${esc(fmtShortDate(budgetEffectiveStart(budget)))}</small>` : ''}
      <small class="balance-card__range">Tolerancia: ${budgetToleranceDays(budget)} día${budgetToleranceDays(budget) === 1 ? '' : 's'} · hasta ${esc(fmtShortDate(budgetEffectiveEnd(budget)))}</small>
      ${budget.manualDone ? `<small class="balance-card__range">✔️ Dada por cumplida por coordinación${budget.manualDoneNote ? ` · ${esc(budget.manualDoneNote)}` : ''}</small>` : ''}
      <div class="budget-kpis budget-kpis--mini">
        <div><span>Asignadas</span><strong>${fmtHours(budget.hours)}</strong></div>
        <div><span>Cumplidas</span><strong>${fmtHours(usage.used)}</strong></div>
        <div><span>Faltan</span><strong class="${faltanCls}">${fmtHours(pendingLeft)}</strong></div>
        ${usage.remaining < 0 ? `<div><span>Horas de más</span><strong>${fmtHours(Math.abs(usage.remaining))}</strong></div>` : ''}
      </div>
      ${progressBar(budget.manualDone ? toNumber(budget.hours) : usage.used, toNumber(budget.hours) || 1)}
      ${isAdminContext() ? `
        <div class="balance-card__actions">
          <button class="btn btn-soft btn-edit-budget" type="button" data-budget-id="${esc(budget.id)}">Editar bolsa</button>
          ${budget.manualDone
            ? `<button class="btn btn-soft btn-toggle-budget-done" type="button" data-budget-id="${esc(budget.id)}" data-done="0">Reabrir bolsa</button>`
            : (usage.remaining > 0 ? `<button class="btn btn-soft btn-toggle-budget-done" type="button" data-budget-id="${esc(budget.id)}" data-done="1">Dar por cumplida</button>` : '')}
        </div>` : ''}
    </div>`;
  }).join('') : '<p class="helper-text">Crea una bolsa de horas (con su rango de fechas) para empezar a comparar acuerdo vs. uso real.</p>';
}

function renderObjectivesTable() {
  const table = $('#tblObjectives');
  if (!table) return;
  const tasks = getSelectedObjectiveTasks();
  table.querySelector('thead').innerHTML = '<tr><th>Tarea agregada</th><th>Tarea / objetivo</th><th>Responsable</th><th>Periodo</th><th>Categoría</th><th>Estimado</th><th>Usado (bolsa)</th><th>Estado</th><th>Acción</th></tr>';

  if (!tasks.length) {
    table.querySelector('tbody').innerHTML = emptyRow(9, 'Aún no hay avances cargados a esta bolsa. Aparecerán aquí cuando un docente registre un avance marcado como “Bolsa de horas”.');
    return;
  }

  const logs = bolsaLogsInScope();
  table.querySelector('tbody').innerHTML = tasks.map(task => {
    const used = bolsaUsedForTask(task.id, logs);
    const over = toNumber(task.estimatedHours) > 0 && used > toNumber(task.estimatedHours);
    return `
      <tr>
        <td data-th="Tarea agregada"><span class="mono">${esc(formatCreatedAt(task))}</span></td>
        <td data-th="Tarea" class="wrap"><strong>${esc(task.title)}</strong><small>${esc(task.description || task.criteria || '')}</small></td>
        <td data-th="Responsable">${esc(task.person || '—')}</td>
        <td data-th="Periodo">${esc(task.period || '—')}</td>
        <td data-th="Categoría">${esc(task.category || '—')}</td>
        <td data-th="Estimado">${fmtHours(task.estimatedHours)}</td>
        <td data-th="Usado"><span class="${over ? 'danger-text' : ''}">${fmtHours(used)}</span></td>
        <td data-th="Estado"><span class="${stateClass(task.state)}">${esc(normalizeState(task.state))}</span></td>
        <td data-th="Acción"><button class="btn btn-dark btn-detail" data-id="${esc(task.id)}" type="button">Abrir</button></td>
      </tr>
    `;
  }).join('');
}

function renderHourLogs() {
  const table = $('#tblHourLogs');
  if (!table) return;
  table.querySelector('thead').innerHTML = '<tr><th>Bitácora registrada</th><th>Tarea</th><th>Responsable</th><th>Ámbito</th><th>Tipo</th><th>Duración</th><th>Reconocidas</th><th>Avance</th></tr>';
  const logs = [...store.hourLogs].sort((a, b) => String(b.createdAt || b.start).localeCompare(String(a.createdAt || a.start)));
  if (!logs.length) {
    table.querySelector('tbody').innerHTML = emptyRow(8, 'Todavía no hay horas registradas.');
    return;
  }
  table.querySelector('tbody').innerHTML = logs.map(log => {
    const scope = logScopeOf(log);
    return `
    <tr>
      <td data-th="Bitácora registrada"><span class="mono">${esc(formatCreatedAt(log))}</span></td>
      <td data-th="Tarea" class="wrap"><strong>${esc(log.taskTitle || log.taskId)}</strong></td>
      <td data-th="Responsable">${esc(log.person || '—')}</td>
      <td data-th="Ámbito"><span class="${logScopeClass(scope)}">${esc(logScopeLabel(scope))}</span></td>
      <td data-th="Tipo">${esc(log.workType || '—')}</td>
      <td data-th="Duración">${fmtHours(log.durationHours)}</td>
      <td data-th="Reconocidas"><strong>${fmtHours(log.recognizedHours || log.durationHours)}</strong></td>
      <td data-th="Avance" class="wrap">${esc(log.advanced || '')}</td>
    </tr>
  `;
  }).join('');
}

/* Convierte a milisegundos cualquier formato de fecha usado en la bitácora:
   Timestamp de Firestore, Date, número o texto ISO. */
function toMillis(value) {
  if (!value) return NaN;
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (Number.isFinite(value.seconds)) return value.seconds * 1000;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? NaN : date.getTime();
}

function formatDateTime(value) {
  if (!value) return '—';
  const millis = toMillis(value);
  if (!Number.isFinite(millis)) return typeof value === 'string' ? value : '—';
  return new Date(millis).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' });
}

function createdAtMillis(record) {
  const direct = toMillis(record?.createdAt);
  if (Number.isFinite(direct)) return direct;
  const encodedTime = String(record?.id || '').split('-')[1];
  const timestamp = encodedTime ? parseInt(encodedTime, 36) : NaN;
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function formatCreatedAt(record) {
  const millis = createdAtMillis(record);
  return Number.isFinite(millis) ? formatDateTime(millis) : '—';
}

function relativeTime(millis) {
  if (!Number.isFinite(millis)) return '';
  const diff = Date.now() - millis;
  if (diff < 0) return 'ahora';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months < 12 ? `hace ${months} mes${months === 1 ? '' : 'es'}` : `hace ${Math.floor(months / 12)} año${months < 24 ? '' : 's'}`;
}

/* Última señal de movimiento de una tarea: la edición más reciente de la tarea
   o el avance de bitácora más reciente cargado a ella. */
function lastActivity(task) {
  let millis = toMillis(task?.updatedAt);
  let source = Number.isFinite(millis) ? 'edición' : '';
  const created = createdAtMillis(task);
  if (!Number.isFinite(millis) && Number.isFinite(created)) {
    millis = created;
    source = 'creación';
  }
  store.hourLogs
    .filter(log => String(log.taskId) === String(task?.id))
    .forEach(log => {
      const logMillis = Math.max(
        Number.isFinite(toMillis(log.createdAt)) ? toMillis(log.createdAt) : -Infinity,
        Number.isFinite(toMillis(log.start)) ? toMillis(log.start) : -Infinity
      );
      if (Number.isFinite(logMillis) && (!Number.isFinite(millis) || logMillis > millis)) {
        millis = logMillis;
        source = 'avance';
      }
    });
  return { millis, source };
}

function lastActivityCell(task) {
  const { millis, source } = lastActivity(task);
  if (!Number.isFinite(millis)) return '<span class="mono">—</span>';
  const fresh = Date.now() - millis < 3 * 24 * 60 * 60 * 1000;
  return `<div class="hours-cell"><strong>${esc(relativeTime(millis))}${fresh ? ' 🟢' : ''}</strong><small>${esc(formatDateTime(millis))}${source ? ` · ${esc(source)}` : ''}</small></div>`;
}

function renderAll() {
  fillFilters();
  renderMetrics();
  renderInsights();
  renderNeedsEstimate();
  renderBudgetSummary();
  renderMainTable();
  renderObjectivesTable();
  renderHourLogs();
}

/* ============================== Modales ================================ */
function showModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal(id) {
  const modal = id ? $(id) : $('.modal.show');
  if (!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  if ($('#logStatus')) $('#logStatus').textContent = '';
}

function openDetailById(id) {
  const task = getTaskById(id);
  if (!task) return;
  currentTask = task;

  $('#logTaskId').value = task.id;
  $('#logTaskSource').value = task.source;
  $('#logTaskIdTxt').textContent = formatCreatedAt(task);
  $('#logTaskName').textContent = task.title || '—';
  $('#logTaskPerson').textContent = task.person || '—';
  $('#logTaskState').textContent = normalizeState(task.state);
  const admin = isAdminContext();
  $('#modalLog')?.classList.toggle('modal--admin-view', admin);
  $('#adminLogOverview').hidden = !admin;
  $('#logEntryPanel').hidden = admin;
  $('#logHistoryTitle').textContent = admin ? 'Avances reportados por la docente' : 'Registros existentes';
  $('#estimateTaskId').value = task.id;
  $('#estimateTitle').value = task.title || '';
  $('#estimateState').value = normalizeState(task.state);
  $('#estimatePeriod').value = task.period || todayMonth();
  $('#estimateHours').value = task.estimatedHours ? round2(task.estimatedHours) : '';
  $('#estimateCategory').value = task.category || '';
  $('#estimateCriteria').value = task.criteria || task.description || '';
  $('#estimateDescription').value = task.description || '';
  $('#estimateAdminNote').value = '';
  const lastAdminChange = task.adminManagementNote
    ? `Último ajuste administrativo: ${task.adminManagementNote}`
    : 'Los cambios de esta sección solo los puede hacer coordinación.';
  $('#estimateAdminHistory').textContent = lastAdminChange;
  $('#logEstado').value = normalizeState(task.state);
  if ($('#logScope')) {
    $('#logScope').value = task.workScope === 'bolsa' ? 'bolsa' : 'jornada';
    updateLogScopeHint();
  }

  setDefaultLogTimes();
  updateDurationPreview();
  loadLogs(task.id);
  showModal('#modalLog');
}

function setDefaultLogTimes() {
  const now = new Date();
  const end = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const startDate = new Date(now.getTime() - 60 * 60000);
  const start = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  if (!$('#logInicio').value) $('#logInicio').value = start;
  if (!$('#logFin').value) $('#logFin').value = end;
}

function loadLogs(id) {
  const timeline = $('#logTimeline');
  const logs = store.hourLogs
    .filter(log => String(log.taskId) === String(id))
    .sort((a, b) => String(b.createdAt || b.start).localeCompare(String(a.createdAt || a.start)));

  const totalHours = logs.reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
  const latest = logs[0];
  if ($('#logCount')) $('#logCount').textContent = String(logs.length);
  if ($('#logTotalHours')) $('#logTotalHours').textContent = fmtHours(totalHours);
  if ($('#logLastUpdate')) $('#logLastUpdate').textContent = latest ? formatCreatedAt(latest) : 'Sin registros';

  timeline.innerHTML = logs.length ? logs.map(log => {
    const scope = logScopeOf(log);
    const budget = log.budgetId ? store.budgets.find(item => String(item.id) === String(log.budgetId)) : null;
    const scopeDetail = budget ? `${logScopeLabel(scope)} · ${fmtBudgetRange(budget)}` : logScopeLabel(scope);
    return `
      <article class="log-entry">
        <div class="log-entry__meta">
          <span>${esc(formatCreatedAt(log))}</span>
          <strong>${fmtHours(log.recognizedHours || log.durationHours)}</strong>
          <span class="${logScopeClass(scope)}">${esc(scopeDetail)}</span>
          <span class="${stateClass(log.state)}">${esc(normalizeState(log.state))}</span>
        </div>
        <p class="log-entry__time">${esc(formatDateTime(log.start))} — ${esc(formatDateTime(log.end))}</p>
        <div class="log-entry__body">
          <div><span>Avanzó</span><p>${esc(log.advanced || 'Sin descripción del avance.')}</p></div>
          ${log.missing ? `<div><span>Falta</span><p>${esc(log.missing)}</p></div>` : ''}
          ${log.improve ? `<div><span>Por mejorar</span><p>${esc(log.improve)}</p></div>` : ''}
          ${log.evidence?.length ? `<div class="log-entry__evidence"><span>Evidencias</span><p>${renderEvidence(log.evidence)}</p></div>` : ''}
        </div>
      </article>
  `;
  }).join('') : '<p class="log-timeline__empty">La docente todavía no ha reportado avances para esta tarea.</p>';
  $('#logStatus').textContent = `${logs.length} registro${logs.length === 1 ? '' : 's'}`;
}

function availableBudgetsForLog() {
  const task = getTaskById($('#logTaskId')?.value) || currentTask;
  const teacherEmail = String(task?.teacherEmail || ME || '').toLowerCase();
  const logDate = dateOnly($('#logInicio')?.value) || todayISO();
  return store.budgets
    .filter(budget => String(budget.teacherEmail || '').toLowerCase() === teacherEmail)
    .filter(budget => {
      const start = dateOnly(budget.startDate);
      const effectiveEnd = budgetEffectiveEnd(budget);
      return (!start || logDate >= start) && (!effectiveEnd || logDate <= effectiveEnd);
    })
    .sort((a, b) => String(a.endDate || '').localeCompare(String(b.endDate || '')));
}

function renderEvidence(items = []) {
  if (!Array.isArray(items) || !items.length) return '<span class="status">Sin evidencia</span>';
  return items.map((item, index) => {
    const label = item.kind === 'link' ? `🔗 Enlace ${index + 1}` : item.type?.startsWith('video/') ? '🎬 Video' : '📷 Foto';
    return `<a class="evidence-chip" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }).join(' ');
}

function evidenceLinks() {
  return String($('#logEvidenceLinks')?.value || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

function validateEvidence(files, links) {
  if (files.length > 5) return 'Puedes adjuntar máximo 5 archivos por avance.';
  if (links.length > 5) return 'Puedes agregar máximo 5 enlaces por avance.';
  for (const link of links) {
    try {
      const url = new URL(link);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch (_) { return `El enlace no es válido: ${link}`; }
  }
  for (const file of files) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return `${file.name}: solo se permiten fotos o videos.`;
    const limit = isVideo ? 30 : 8;
    if (file.size > limit * 1024 * 1024) return `${file.name} supera el límite de ${limit} MB.`;
  }
  return '';
}

function safeStorageName(name) {
  return String(name || 'archivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
}

async function uploadEvidence(files, teacherEmail, taskId, logId) {
  const uploaded = [];
  try {
    for (const file of files) {
      const path = `academic-evidence/${teacherEmail}/${taskId}/${logId}/${Date.now()}-${safeStorageName(file.name)}`;
      const storageRef = ref(STORAGE, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      uploaded.push({ kind: 'file', name: file.name, type: file.type, size: file.size, path, url: await getDownloadURL(storageRef) });
    }
    return uploaded;
  } catch (error) {
    await Promise.allSettled(uploaded.map(item => deleteObject(ref(STORAGE, item.path))));
    throw error;
  }
}

function updateLogBudgetOptions(preferredId = '') {
  const field = $('#logBudgetField');
  const select = $('#logBudgetId');
  if (!field || !select) return;
  const isBolsa = norm($('#logScope')?.value).includes('bolsa');
  field.hidden = !isBolsa;
  select.required = isBolsa;
  if (!isBolsa) {
    select.innerHTML = '';
    return;
  }
  const budgets = availableBudgetsForLog();
  select.innerHTML = budgets.length
    ? budgets.map(budget => {
      const usage = budgetUsage(budget);
      const remaining = Math.max(0, usage.remaining);
      const completed = isBudgetDone(budget, usage);
      return `<option value="${esc(budget.id)}" ${completed ? 'disabled' : ''}>${esc(fmtBudgetRange(budget))} · ${completed ? 'ya cumplida' : `faltan ${fmtHours(remaining)}`}</option>`;
    }).join('')
    : '<option value="">No hay una bolsa disponible para esta fecha</option>';
  const wanted = preferredId || select.dataset.selected || '';
  if (wanted && budgets.some(budget => String(budget.id) === String(wanted))) {
    select.value = wanted;
  } else {
    const oldestPending = budgets.find(budget => !isBudgetDone(budget));
    if (oldestPending) select.value = oldestPending.id;
  }
  delete select.dataset.selected;
}

function updateLogScopeHint() {
  const hint = $('#logScopeHint');
  if (!hint) return;
  const isBolsa = norm($('#logScope')?.value).includes('bolsa');
  hint.textContent = isBolsa
    ? 'Elige la semana a la que se abonarán estas horas. Puedes registrar horas adicionales aunque la bolsa ya quede cumplida.'
    : 'Jornada normal: se trabaja dentro del horario y NO descuenta de la bolsa de horas.';
  updateLogBudgetOptions();
}

function updateDurationPreview() {
  const hours = durationHours($('#logInicio')?.value, $('#logFin')?.value);
  const preview = $('#durationPreview');
  if (preview) preview.textContent = hours ? `Duración calculada: ${fmtHours(hours)}` : 'Duración: revisa inicio y fin';
}

async function submitLog(event) {
  event.preventDefault();
  const form = $('#logForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const id = $('#logTaskId').value.trim();
  const task = getTaskById(id) || currentTask;
  const start = $('#logInicio').value;
  const end = $('#logFin').value;
  const calculated = durationHours(start, end);
  const recognized = $('#logHorasReconocidas').value ? toNumber($('#logHorasReconocidas').value) : calculated;
  const state = $('#logEstado').value;
  const advanced = $('#logAvanzo').value.trim();
  const missing = $('#logFalta').value.trim();
  const improve = $('#logMejorar').value.trim();
  const workType = $('#logTipoTrabajo').value;
  const logScope = norm($('#logScope')?.value).includes('bolsa') ? 'bolsa' : 'jornada';
  const budgetId = logScope === 'bolsa' ? String($('#logBudgetId')?.value || '') : '';
  const files = Array.from($('#logEvidenceFiles')?.files || []);
  const links = evidenceLinks();
  const evidenceError = validateEvidence(files, links);

  if (!id) return showFormMessage('Falta el ID de la tarea.', true);
  if (calculated <= 0) return showFormMessage('La fecha de fin debe ser posterior al inicio.', true);
  if (!advanced) return showFormMessage('Describe qué se avanzó.', true);
  if (evidenceError) return showFormMessage(evidenceError, true);
  if (logScope === 'bolsa' && !budgetId) return showFormMessage('Selecciona la bolsa o semana a la que se sumarán estas horas.', true);
  if (logScope === 'bolsa') {
    const selectedBudget = store.budgets.find(budget => String(budget.id) === budgetId);
    if (!selectedBudget) return showFormMessage('La bolsa seleccionada ya no está disponible.', true);
    if (selectedBudget.manualDone) return showFormMessage('Coordinación ya dio por cumplida esta bolsa. Selecciona otra semana pendiente.', true);
    const remaining = Math.max(0, budgetUsage(selectedBudget).remaining);
    if (remaining <= 0) return showFormMessage('Ya se cumplió esta bolsa. Selecciona otra semana pendiente.', true);
    if (recognized > remaining) {
      return showFormMessage(`Esta bolsa solo tiene ${fmtHours(remaining)} pendientes. Ajusta las horas reconocidas para no excederla.`, true);
    }
  }

  const submitButton = $('#logForm button[type="submit"]');
  submitButton.disabled = true;
  showFormMessage('Guardando…');

  const logId = uid('LOG');
  const log = {
    id: logId,
    taskId: id,
    taskTitle: task?.title || $('#logTaskName').textContent.trim(),
    teacherEmail: task?.teacherEmail || ME,
    teacherName: task?.teacherName || task?.person || $('#logTaskPerson').textContent.trim(),
    person: task?.person || $('#logTaskPerson').textContent.trim(),
    period: task?.period || todayMonth(),
    start, end,
    durationHours: calculated,
    recognizedHours: recognized,
    workType, logScope, budgetId, state,
    advanced, missing, improve, evidence: [],
    createdAt: new Date().toISOString()
  };

  try {
    showFormMessage(files.length ? `Subiendo ${files.length} archivo${files.length === 1 ? '' : 's'}…` : 'Guardando…');
    const uploaded = await uploadEvidence(files, log.teacherEmail, id, logId);
    log.evidence = [...uploaded, ...links.map(url => ({ kind: 'link', url }))];
    await dbSaveHourLog(log);
    store.hourLogs.push(log);
    // Actualiza el estado de la tarea según el último cierre.
    await dbSaveObjective({ id, state });
    const localTask = store.objectives.find(item => String(item.id) === String(id));
    if (localTask) localTask.state = state;

    clearLogFormKeepTask();
    loadLogs(id);
    renderAll();
    showFormMessage('Avance guardado ✔');
  } catch (err) {
    console.error(err);
    showFormMessage(`No se pudo guardar: ${err.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
}

function showFormMessage(message, isError = false) {
  const el = $('#logStatus');
  if (!el) return;
  el.textContent = message;
  el.className = isError ? 'status status--error' : 'status';
}

function showEstimateSaveStatus(message = '', kind = 'success') {
  const status = $('#estimateSaveStatus');
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
  status.className = `save-feedback${kind === 'saving' ? ' save-feedback--saving' : kind === 'error' ? ' save-feedback--error' : ''}`;
}

function clearLogFormKeepTask() {
  ['#logInicio', '#logFin', '#logHorasReconocidas', '#logAvanzo', '#logFalta', '#logMejorar', '#logEvidenceLinks', '#logEvidenceFiles'].forEach(sel => {
    if ($(sel)) $(sel).value = '';
  });
  setDefaultLogTimes();
  updateDurationPreview();
  updateLogBudgetOptions();
}

async function saveEstimate(event) {
  event.preventDefault();
  if (!isAdminContext()) {
    showFormMessage('Solo coordinación puede modificar la estimación o la bolsa de horas.', true);
    return;
  }
  const id = $('#estimateTaskId').value.trim();
  if (!id) return;

  const task = getTaskById(id) || currentTask;
  const state = $('#estimateState').value;
  const stateChanged = task && normalizeState(task.state) !== normalizeState(state);
  const note = $('#estimateAdminNote').value.trim();
  const patch = {
    id,
    title: $('#estimateTitle').value.trim(),
    state,
    period: $('#estimatePeriod').value || todayMonth(),
    estimatedHours: $('#estimateHours').value ? toNumber($('#estimateHours').value) : 0,
    category: $('#estimateCategory').value || '',
    criteria: $('#estimateCriteria').value.trim(),
    description: $('#estimateDescription').value.trim(),
    adminManagementNote: note,
    adminManagementUpdatedAt: new Date().toISOString(),
    adminManagementUpdatedBy: ME,
    ...(stateChanged ? { stateChangedAt: new Date().toISOString(), stateChangedBy: ME } : {})
  };
  if (!patch.title) {
    showEstimateSaveStatus('La tarea necesita un título.', 'error');
    return;
  }

  const submitButton = $('#estimateSubmit');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando…';
  }
  showEstimateSaveStatus('Guardando cambios…', 'saving');

  try {
    await dbSaveObjective(patch);
    const localTask = store.objectives.find(item => String(item.id) === String(id));
    if (localTask) Object.assign(localTask, patch);
    currentTask = getTaskById(id);
    renderAll();
    $('#logTaskName').textContent = patch.title;
    $('#logTaskState').textContent = normalizeState(patch.state);
    showEstimateSaveStatus('Cambios guardados correctamente ✓');
  } catch (err) {
    console.error(err);
    showEstimateSaveStatus(`No se pudieron guardar los cambios: ${err.message}`, 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Guardar cambios';
    }
  }
}

async function deleteObjectiveWithLogs(id) {
  if (!isAdminContext()) return;
  const task = getTaskById(id) || currentTask;
  if (!task) return;
  const logs = store.hourLogs.filter(log => String(log.taskId) === String(id));
  const text = `¿Eliminar definitivamente "${task.title}"? Se eliminarán también ${logs.length} registro(s) de avance. Esta acción no se puede deshacer.`;
  if (!confirm(text)) return;
  try {
    const refs = [doc(DB, COL.objectives, id), ...logs.map(log => doc(DB, COL.hourLogs, log.id))];
    for (let index = 0; index < refs.length; index += 400) {
      const batch = writeBatch(DB);
      refs.slice(index, index + 400).forEach(item => batch.delete(item));
      await batch.commit();
    }
    store.objectives = store.objectives.filter(item => String(item.id) !== String(id));
    store.hourLogs = store.hourLogs.filter(log => String(log.taskId) !== String(id));
    currentTask = null;
    hideModal('#modalLog');
    renderAll();
    setStatus('Tarea y sus registros eliminados.');
  } catch (err) {
    console.error(err);
    showFormMessage(`No se pudo eliminar: ${err.message}`, true);
  }
}

async function createObjective(event) {
  event.preventDefault();
  if (!isAdminContext()) {
    alert('Solo coordinación puede asignar tareas desde este módulo.');
    return;
  }
  const form = $('#objectiveForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const assigned = selectedTeacherFor('objective');
  if (!assigned.email) {
    alert('Selecciona la docente responsable de la tarea.');
    return;
  }

  const task = {
    id: uid('OBJ'),
    title: $('#objTitle').value.trim(),
    teacherEmail: assigned.email,
    teacherName: assigned.label,
    person: assigned.label,
    period: $('#objPeriod').value || todayMonth(),
    estimatedHours: toNumber($('#objHours').value),
    category: $('#objCategory').value,
    state: $('#objState').value,
    description: $('#objDescription').value.trim(),
    urgency: '',
    dueDate: '',
    createdAt: new Date().toISOString()
  };

  try {
    await dbSaveObjective(task);
    store.objectives.push(task);
    form.reset();
    $('#objPeriod').value = todayMonth();
    $('#objPerson').value = inferPerson();
    hideModal('#modalObjective');
    switchView('tareas');
    openDetailById(task.id);
  } catch (err) {
    console.error(err);
    alert(`No se pudo crear la tarea: ${err.message}`);
  }
}

async function saveBudget(event) {
  event.preventDefault();
  if (!isAdminContext()) {
    alert('Solo coordinación puede asignar o modificar bolsas de horas.');
    return;
  }
  const form = $('#budgetForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const assigned = selectedTeacherFor('budget');
  if (!assigned.email) {
    alert('Selecciona la docente de la bolsa de horas.');
    return;
  }
  const startDate = $('#budgetStart').value;
  const endDate = $('#budgetEnd').value;
  if (!startDate || !endDate) {
    alert('Define el rango de fechas (desde / hasta) en que se deben cumplir las horas.');
    return;
  }
  if (endDate < startDate) {
    alert('La fecha "hasta" no puede ser anterior a la fecha "desde".');
    return;
  }
  const person = assigned.label;
  const wholeHours = Math.max(0, Number($('#budgetHours').value) || 0);
  const minutes = Math.max(0, Math.min(59, Number($('#budgetMinutes').value) || 0));
  const hours = round2(wholeHours + minutes / 60);
  if (hours <= 0) {
    alert('Indica cuántas horas o minutos se deben cumplir.');
    return;
  }
  const toleranceDays = Math.max(0, Math.min(30, Number($('#budgetToleranceDays').value) || 0));
  const leadDays = Math.max(0, Math.min(30, Number($('#budgetLeadDays').value) || 0));
  const note = $('#budgetNote').value.trim();
  const period = String(startDate).slice(0, 7); // mes de inicio (compatibilidad)
  const editingId = String($('#budgetId').value || '');
  const existing = editingId
    ? store.budgets.find(budget => String(budget.id) === editingId)
    : store.budgets.find(budget =>
      String(budget.teacherEmail || '').toLowerCase() === assigned.email &&
      dateOnly(budget.startDate) === startDate && dateOnly(budget.endDate) === endDate);

  const budget = existing
    ? { ...existing, teacherEmail: assigned.email, teacherName: assigned.label, person, hours, toleranceDays, leadDays, note, startDate, endDate, period, updatedAt: new Date().toISOString() }
    : { id: uid('BOLSA'), teacherEmail: assigned.email, teacherName: assigned.label, person, hours, toleranceDays, leadDays, note, startDate, endDate, period, createdAt: new Date().toISOString() };

  try {
    await dbSaveBudget(budget);
    if (existing) Object.assign(existing, budget);
    else store.budgets.push(budget);
    renderAll();
    resetBudgetForm(assigned.email);
  } catch (err) {
    console.error(err);
    alert(`No se pudo guardar la bolsa: ${err.message}`);
  }
}

function resetBudgetForm(teacherEmail = '') {
  const form = $('#budgetForm');
  form?.reset();
  $('#budgetId').value = '';
  $('#budgetToleranceDays').value = '7';
  $('#budgetLeadDays').value = '0';
  $('#budgetSubmit').textContent = 'Guardar bolsa';
  $('#budgetCancelEdit').hidden = true;
  fillTeacherSelect($('#budgetTeacherEmail'), teacherEmail || (isAdminContext() ? '' : ME));
  const teacher = getTeacherFromDirectory(teacherEmail || ME);
  $('#budgetPerson').value = teacher?.label || (isAdminContext() ? '' : inferPerson());
  $('#budgetStart').value = todayISO();
  $('#budgetEnd').value = addDaysISO(todayISO(), 7);
}

function editBudget(budgetId) {
  if (!isAdminContext()) return;
  const budget = store.budgets.find(item => String(item.id) === String(budgetId));
  if (!budget) return;
  $('#budgetId').value = budget.id;
  fillTeacherSelect($('#budgetTeacherEmail'), String(budget.teacherEmail || '').toLowerCase());
  $('#budgetPerson').value = budget.teacherName || budget.person || '';
  const totalMin = Math.round((Number(budget.hours) || 0) * 60);
  $('#budgetHours').value = Math.floor(totalMin / 60) || '';
  $('#budgetMinutes').value = totalMin % 60 || '';
  $('#budgetStart').value = dateOnly(budget.startDate);
  $('#budgetEnd').value = dateOnly(budget.endDate);
  $('#budgetToleranceDays').value = budgetToleranceDays(budget);
  $('#budgetLeadDays').value = budgetLeadDays(budget);
  $('#budgetNote').value = budget.note || '';
  $('#budgetSubmit').textContent = 'Actualizar bolsa';
  $('#budgetCancelEdit').hidden = false;
  $('#budgetForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}


/* Coordinación puede dar por cumplida una bolsa aunque las horas no cuadren
   (p. ej. la docente trabajó, pero registró fuera del rango o hubo un error). */
async function toggleBudgetDone(budgetId, markDone) {
  if (!isAdminContext()) {
    alert('Solo coordinación puede dar por cumplida o reabrir una bolsa.');
    return;
  }
  const budget = store.budgets.find(item => String(item.id) === String(budgetId));
  if (!budget) return;

  let note = '';
  if (markDone) {
    note = prompt('¿Por qué se da por cumplida esta bolsa? (motivo del ajuste, opcional)') ?? null;
    if (note === null) return; // canceló
    note = note.trim();
  } else if (!confirm('¿Reabrir esta bolsa? Volverá a mostrar las horas que faltan.')) {
    return;
  }

  const updated = markDone
    ? { ...budget, manualDone: true, manualDoneNote: note, manualDoneBy: ME, manualDoneAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    : { ...budget, manualDone: false, manualDoneNote: '', updatedAt: new Date().toISOString() };

  try {
    await dbSaveBudget(updated);
    Object.assign(budget, updated);
    renderAll();
  } catch (err) {
    console.error(err);
    alert(`No se pudo actualizar la bolsa: ${err.message}`);
  }
}

/* --------------------------- Export / utilidades ----------------------- */
function downloadText(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(headers, rows) {
  return [headers, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
}

function exportHoursCsv() {
  if (!isAdminContext()) return;
  const headers = ['ID registro', 'ID tarea', 'Tarea', 'Responsable', 'Periodo', 'Ámbito', 'Inicio', 'Fin', 'Duración horas', 'Horas reconocidas', 'Tipo de trabajo', 'Estado', 'Avance', 'Falta', 'Mejora'];
  const rows = store.hourLogs.map(log => [
    log.id, log.taskId, log.taskTitle, log.person, log.period, logScopeLabel(logScopeOf(log)), log.start, log.end,
    round2(log.durationHours), round2(log.recognizedHours || log.durationHours),
    log.workType, log.state, log.advanced, log.missing, log.improve
  ]);
  downloadText(`bolsa-horas-musicala-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(headers, rows), 'text/csv;charset=utf-8');
}

function exportJson() {
  const payload = { exportedAt: new Date().toISOString(), app: 'Bitácora Musicala · Firebase', teacher: ME, data: store };
  downloadText(`respaldo-bitacora-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

function reportTeacherOptions() {
  const select = $('#academicReportTeacher');
  if (!select) return;
  const selected = select.value;
  const teachers = new Map();
  [...store.objectives, ...store.hourLogs, ...store.budgets].forEach(item => {
    const email = String(item.teacherEmail || '').toLowerCase().trim();
    const name = String(item.teacherName || item.person || '').trim();
    if (email) teachers.set(email, name || email);
  });
  teacherDirectory.forEach(teacher => { if (teacher?.email && !teacher.isAdmin) teachers.set(teacher.email, teacher.label || teacher.email); });
  select.innerHTML = `<option value="">Todas las docentes</option>${[...teachers.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([email, name]) => `<option value="${esc(email)}">${esc(name)}${name !== email ? ` · ${esc(email)}` : ''}</option>`).join('')}`;
  select.value = teachers.has(selected) ? selected : '';
}

function reportDate(record) {
  const time = new Date(record?.start || record?.createdAt || record?.updatedAt || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function mdValue(value) { return String(value ?? '').trim() || 'Sin información registrada.'; }

function buildAcademicReport(teacherEmail = '') {
  const matchesTeacher = item => !teacherEmail || String(item.teacherEmail || '').toLowerCase() === teacherEmail;
  const tasks = store.objectives.filter(matchesTeacher).sort((a, b) => reportDate(a) - reportDate(b));
  const logs = store.hourLogs.filter(matchesTeacher).sort((a, b) => reportDate(a) - reportDate(b));
  const selectedName = teacherEmail ? (teacherDirectory.find(item => item.email === teacherEmail)?.label || tasks[0]?.person || logs[0]?.person || teacherEmail) : 'Todas las docentes';
  const taskIds = new Set(tasks.map(task => String(task.id)));
  const orphanLogs = logs.filter(log => !taskIds.has(String(log.taskId)));
  const estimated = tasks.reduce((sum, task) => sum + toNumber(task.estimatedHours), 0);
  const recognized = logs.reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
  const stateCount = tasks.reduce((acc, task) => { const state = normalizeState(task.state); acc[state] = (acc[state] || 0) + 1; return acc; }, {});
  const lines = [
    '# Informe de bitácoras de tareas académicas', '',
    `- Generado: ${formatDateTime(new Date().toISOString())}`,
    `- Alcance: ${selectedName}`,
    `- Tareas incluidas: ${tasks.length}`,
    `- Registros de avance incluidos: ${logs.length}`,
    `- Horas estimadas: ${fmtHours(estimated)}`,
    `- Horas reconocidas registradas: ${fmtHours(recognized)}`,
    `- Estados de tareas: ${Object.entries(stateCount).map(([state, count]) => `${state} (${count})`).join(', ') || 'Sin tareas.'}`, '',
    '## Instrucción para la IA', '',
    'Analiza exclusivamente la evidencia de este informe. Para cada docente y tarea: (1) evalúa si avances, pendientes y mejoras son coherentes con el objetivo y estado; (2) califica el diligenciamiento como completo, parcial o insuficiente y explica qué falta; (3) describe el avance real frente a horas estimadas y estado declarado, sin inventar información; (4) identifica riesgos, bloqueos, contradicciones o falta de evidencia; (5) propone recomendaciones concretas y respetuosas. Cierra con un resumen ejecutivo y prioriza las tareas que requieren seguimiento de coordinación.', '',
    '## Detalle por tarea', ''
  ];
  tasks.forEach((task, index) => {
    const taskLogs = logs.filter(log => String(log.taskId) === String(task.id));
    const taskHours = taskLogs.reduce((sum, log) => sum + toNumber(log.recognizedHours || log.durationHours), 0);
    lines.push(`### ${index + 1}. ${mdValue(task.title)}`, '', `- Responsable: ${mdValue(task.person || task.teacherName || task.teacherEmail)}`, `- Periodo: ${mdValue(task.period)}`, `- Estado declarado: ${normalizeState(task.state)}`, `- Creada: ${formatCreatedAt(task)}`, `- Horas estimadas: ${fmtHours(task.estimatedHours)}`, `- Horas reconocidas en avances: ${fmtHours(taskHours)}`, `- Objetivo / entregable: ${mdValue(task.description || task.criteria)}`, '', '#### Registros de avance', '');
    if (!taskLogs.length) lines.push('- No hay registros de avance para esta tarea.', '');
    taskLogs.forEach((log, logIndex) => lines.push(`**Registro ${logIndex + 1} · ${formatDateTime(log.start || log.createdAt)}**`, `- Estado: ${mdValue(log.state)}`, `- Ámbito: ${logScopeLabel(logScopeOf(log))} · Tipo: ${mdValue(log.workType)}`, `- Duración: ${fmtHours(log.durationHours)} · Reconocidas: ${fmtHours(log.recognizedHours || log.durationHours)}`, `- Avancé: ${mdValue(log.advanced)}`, `- Falta: ${mdValue(log.missing)}`, `- Por mejorar: ${mdValue(log.improve)}`, `- Evidencias: ${mdValue(log.evidenceLinks)}`, ''));
  });
  if (orphanLogs.length) {
    lines.push('## Registros sin tarea asociada', '');
    orphanLogs.forEach(log => lines.push(`- ${formatDateTime(log.start || log.createdAt)} · ${mdValue(log.taskTitle || log.taskId)} · ${mdValue(log.advanced)}`));
  }
  return lines.join('\n');
}

function openAcademicReportModal() {
  if (!isAdminContext()) return;
  reportTeacherOptions();
  showModal('#modalAcademicReport');
}

function downloadAcademicReport() {
  if (!isAdminContext()) return;
  const teacherEmail = $('#academicReportTeacher')?.value || '';
  const slug = teacherEmail ? teacherEmail.split('@')[0].replace(/[^a-z0-9]+/gi, '-') : 'todas-docentes';
  downloadText(`informe-bitacoras-ia-${slug}-${new Date().toISOString().slice(0, 10)}.md`, buildAcademicReport(teacherEmail), 'text/markdown;charset=utf-8');
  hideModal('#modalAcademicReport');
}

/* ============================== Eventos =============================== */
function goBackToHub() {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'closeAcademicModule' }, '*');
      return;
    }
  } catch (_) { /* cross-origin */ }
  if (history.length > 1) history.back();
}

function applyRoleScope() {
  const back = $('#btnBackHub');
  if (back) back.hidden = !ACADEMIC_CTX.embedded;

  const admin = isAdminContext();
  document.body.classList.toggle('is-admin-context', admin);
  const reportButton = $('#btnAcademicReport');
  if (reportButton) reportButton.hidden = !admin;
  const exportHoursButton = $('#btnExportHours');
  if (exportHoursButton) exportHoursButton.hidden = !admin;
  ['#btnNewObjective', '#budgetForm', '#estimateForm'].forEach(sel => {
    const el = $(sel);
    if (el) el.hidden = !admin;
  });
  // Paneles que solo usa coordinación (planeación / estimación de horas):
  const needsEstimatePanel = $('#panelNeedsEstimate');
  if (needsEstimatePanel) needsEstimatePanel.hidden = !admin;
  const estimateSubpanel = $('#estimateForm')?.closest('.subpanel');
  if (estimateSubpanel) estimateSubpanel.hidden = !admin;

  if (admin) return; // admin ve y filtra todo

  const me = inferPerson();
  if (!me) return;
  ['#fPersona', '#fBolsaPersona'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.value = me;
    el.dataset.locked = '1';
    el.title = 'Filtrado a tu información';
  });
}

function attachEvents() {
  $$('.tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));

  $('#btnReload')?.addEventListener('click', async () => {
    try { await loadAll(); renderAll(); applyRoleScope(); }
    catch (err) { console.error(err); setStatus(`Error: ${err.message}`, true); }
  });

  $('#btnNewObjective')?.addEventListener('click', () => {
    $('#objectiveForm')?.reset();
    $('#objPeriod').value = todayMonth();
    fillTeacherSelect($('#objTeacherEmail'), isAdminContext() ? '' : ME);
    $('#objPerson').value = isAdminContext() ? '' : inferPerson();
    showModal('#modalObjective');
  });

  $('#fPersona')?.addEventListener('change', renderAll);
  $('#fEstado')?.addEventListener('change', renderAll);
  $('#fUrgencia')?.addEventListener('change', renderAll);
  $('#q')?.addEventListener('input', debounce(renderAll, 180));
  $('#fBolsaPersona')?.addEventListener('change', renderAll);
  $('#qBolsa')?.addEventListener('input', debounce(renderAll, 180));
  $('#objTeacherEmail')?.addEventListener('change', () => {
    const t = getTeacherFromDirectory($('#objTeacherEmail').value);
    if (t) $('#objPerson').value = t.label;
  });
  $('#budgetTeacherEmail')?.addEventListener('change', () => {
    const t = getTeacherFromDirectory($('#budgetTeacherEmail').value);
    if (t) $('#budgetPerson').value = t.label;
  });

  document.addEventListener('click', event => {
    const detail = event.target.closest('.btn-detail');
    if (detail?.dataset?.id) openDetailById(detail.dataset.id);
    const editBudgetButton = event.target.closest('.btn-edit-budget');
    if (editBudgetButton?.dataset?.budgetId) editBudget(editBudgetButton.dataset.budgetId);
    const toggleDoneButton = event.target.closest('.btn-toggle-budget-done');
    if (toggleDoneButton?.dataset?.budgetId) toggleBudgetDone(toggleDoneButton.dataset.budgetId, toggleDoneButton.dataset.done === '1');
    const deleteTaskButton = event.target.closest('#btnDeleteObjective');
    if (deleteTaskButton && currentTask?.id) deleteObjectiveWithLogs(currentTask.id);
    if (event.target.dataset.close) hideModal(event.target.closest('.modal') ? `#${event.target.closest('.modal').id}` : null);
  });

  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideModal(); });

  $('#logForm')?.addEventListener('submit', submitLog);
  $('#estimateForm')?.addEventListener('submit', saveEstimate);
  $('#estimateForm')?.addEventListener('input', () => showEstimateSaveStatus());
  $('#objectiveForm')?.addEventListener('submit', createObjective);
  $('#budgetForm')?.addEventListener('submit', saveBudget);
  $('#btnExportHours')?.addEventListener('click', exportHoursCsv);
  $('#btnExportJson')?.addEventListener('click', exportJson);
  $('#btnAcademicReport')?.addEventListener('click', openAcademicReportModal);
  $('#btnDownloadAcademicReport')?.addEventListener('click', downloadAcademicReport);
  $('#logInicio')?.addEventListener('change', updateDurationPreview);
  $('#logInicio')?.addEventListener('change', updateLogBudgetOptions);
  $('#logFin')?.addEventListener('change', updateDurationPreview);
  $('#logScope')?.addEventListener('change', updateLogScopeHint);
  $('#budgetCancelEdit')?.addEventListener('click', () => resetBudgetForm());
  $('#btnBackHub')?.addEventListener('click', goBackToHub);

  // Estos botones eran de la era localStorage; ya no aplican (todo va a Firebase).
  $('#btnClearLocal')?.setAttribute('hidden', '');
  $('#importJson')?.closest('.file-btn')?.setAttribute('hidden', '');
}

async function init() {
  readContextFromUrl();
  attachEvents();
  // Rango por defecto de la bolsa: de hoy a una semana, más 7 días de tolerancia.
  if ($('#budgetStart')) $('#budgetStart').value = todayISO();
  if ($('#budgetEnd')) $('#budgetEnd').value = addDaysISO(todayISO(), 7);
  if ($('#budgetToleranceDays')) $('#budgetToleranceDays').value = '7';
  $('#objPeriod').value = todayMonth();

  // Firebase: reutiliza la sesión del HUB (mismo origen).
  const app = initializeApp(firebaseConfig);
  AUTH = getAuth(app);
  DB = getFirestore(app);
  STORAGE = getStorage(app);

  setStatus('Verificando sesión…');
  onAuthStateChanged(AUTH, async (user) => {
    if (!user) {
      setStatus('No hay sesión activa. Vuelve al HUB e inicia sesión.', true);
      return;
    }
    ME = String(user.email || '').toLowerCase();
    if (!ACADEMIC_CTX.name) ACADEMIC_CTX.name = user.displayName || ME;
    if (!ACADEMIC_CTX.email) ACADEMIC_CTX.email = ME;

    applyBranding();
    await loadTeacherDirectory();
    fillTeacherSelect($('#objTeacherEmail'), isAdminContext() ? '' : ME);
    fillTeacherSelect($('#budgetTeacherEmail'), isAdminContext() ? '' : ME);
    $('#budgetPerson').value = isAdminContext() ? '' : inferPerson();
    $('#objPerson').value = isAdminContext() ? '' : inferPerson();

    try {
      await loadAll();
    } catch (err) {
      console.error(err);
      setStatus(`No se pudieron cargar los datos: ${err.message}`, true);
    } finally {
      renderTabs();
      renderAll();
      applyRoleScope();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
