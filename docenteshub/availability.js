import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const STATUS = { pending: "Pendiente de Wix", synced: "Sincronizado con Wix", error: "Pendiente de Wix · requiere atención", cancelling: "Retirando bloqueo de Wix", cancelled: "Retirado" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function openAvailability({ db, email, isAdmin, onClose = () => {} }) {
  const previousFocus = document.activeElement;
  const modal = document.createElement("div");
  modal.className = "teacherScheduleModal availabilityModal";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  modal.innerHTML = `<div class="teacherScheduleCard availabilityCard" role="dialog" aria-modal="true" aria-labelledby="availabilityTitle">
    <div class="teacherScheduleHead"><h2 id="availabilityTitle">Mi disponibilidad</h2><button type="button" class="btnGhost" data-close>Cerrar</button></div>
    <p>Registra cuándo <strong>no puedes dar clase</strong>. Horarios de Colombia. Los bloqueos semanales se repiten hasta que los retires o termine su vigencia.</p>
    <p>Las clases ya asignadas y las sesiones grupales publicadas deben revisarse con coordinación; este registro no las cancela.</p>
    <form class="availabilityForm">
      <label>Tipo de bloqueo<select name="kind"><option value="weekly">Cada semana</option><option value="date">Una fecha específica</option></select></label>
      <label data-weekday>Día de la semana<select name="weekday">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}">${DAYS[d]}</option>`).join("")}</select></label>
      <label>Desde / fecha<input type="date" name="dateFrom" min="${today}" max="2099-12-31" value="${today}" required></label>
      <label data-until>Hasta (opcional)<input type="date" name="dateUntil" min="${today}" max="2099-12-31"></label>
      <label class="availabilityFull"><input name="allDay" type="checkbox"> No puedo durante todo el día</label>
      <label>Hora inicial<input name="start" type="time" value="08:00" required></label>
      <label>Hora final<input name="end" type="time" value="12:00" required></label>
      <label class="availabilityFull">Motivo (opcional, visible para coordinación)<input name="reason" maxlength="200" placeholder="Ej. Universidad"></label>
      <button class="btnGhost availabilityFull" type="submit">Guardar y bloquear en Wix</button>
    </form>
    <p data-feedback role="status" aria-live="polite"></p>
    <div class="teacherScheduleHead"><h3>Bloqueos registrados</h3>${isAdmin ? '<label><input type="checkbox" data-all> Ver todos los docentes</label>' : ""}</div>
    <div data-list>Cargando…</div>
  </div>`;
  document.body.appendChild(modal);
  const form = modal.querySelector("form");
  const feedback = modal.querySelector("[data-feedback]");
  const list = modal.querySelector("[data-list]");
  const call = httpsCallable(getFunctions(db.app, "us-central1"), "manageTeacherAvailability");
  let stop = () => {};
  let stopAuth = () => {};
  let busy = false;
  let requestId = null;
  let records = [];
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  function close() {
    if (busy) { feedback.textContent = "Espera a que termine la sincronización."; return; }
    stop(); stopAuth(); document.removeEventListener("keydown", keydown); modal.remove(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); onClose();
  }
  function keydown(event) {
    if (event.key === "Escape") close();
    if (event.key === "Tab") {
      const focusable = [...modal.querySelectorAll("button,input,select")].filter(e => !e.disabled && e.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  document.addEventListener("keydown", keydown);
  modal.querySelector("[data-close]").onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };
  function updateInputs() {
    const weekly = form.elements.kind.value === "weekly";
    modal.querySelector("[data-weekday]").hidden = !weekly;
    modal.querySelector("[data-until]").hidden = !weekly;
    for (const name of ["start", "end"]) form.elements[name].disabled = form.elements.allDay.checked;
  }
  form.onchange = updateInputs;
  function subscribe(all = false) {
    stop();
    const source = collection(db, "teacherAvailability");
    stop = onSnapshot(all && isAdmin ? source : query(source, where("teacherEmail", "==", email)), snap => {
      records = snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(d => d.status !== "cancelled");
      records.sort((a, b) => a.teacherEmail.localeCompare(b.teacherEmail) || a.dateFrom.localeCompare(b.dateFrom));
      paint();
    }, () => { list.textContent = "No se pudieron consultar los bloqueos. Revisa la conexión y los permisos."; });
  }
  function paint() {
    list.innerHTML = records.length ? records.map(r => `<article class="availabilityRecord">
      ${isAdmin ? `<strong>${esc(r.teacherEmail)}</strong>` : ""}
      <p><strong>${r.kind === "weekly" ? `Cada ${DAYS[r.weekday]}` : esc(r.dateFrom)}</strong> · ${r.allDay ? "Todo el día" : `${esc(r.start)} – ${esc(r.end)}`}</p>
      ${r.kind === "weekly" ? `<p>Desde ${esc(r.dateFrom)}${r.dateUntil ? ` hasta ${esc(r.dateUntil)}` : " · Sin fecha final"}</p>` : ""}
      ${r.reason ? `<p>${esc(r.reason)}</p>` : ""}
      <p class="availabilityStatus">${STATUS[r.status] || "Pendiente de Wix"}</p>${r.error ? `<p>${esc(r.error)}</p>` : ""}
      ${r.status !== "synced" ? `<button type="button" class="btnGhost" data-action="retry" data-id="${esc(r.id)}" ${busy ? "disabled" : ""}>Reintentar sincronización</button>` : ""}
      <button type="button" class="btnGhost" data-action="cancel" data-id="${esc(r.id)}" ${busy ? "disabled" : ""}>Retirar bloqueo</button>
    </article>`).join("") : "<p>No hay bloqueos registrados.</p>";
  }
  async function run(payload) {
    if (busy) return;
    busy = true; paint();
    form.querySelector("button[type=submit]").disabled = true;
    feedback.textContent = "Sincronizando con Wix…";
    try {
      const result = await call(payload);
      feedback.textContent = result.data.status === "cancelled" ? "Bloqueo retirado del Hub y de Wix." : "Bloqueo guardado y sincronizado con Wix.";
      requestId = null;
    } catch (error) {
      feedback.textContent = `${error.message || "No se pudo sincronizar."} Si aparece en la lista, usa Reintentar sincronización.`;
    } finally { busy = false; form.querySelector("button[type=submit]").disabled = false; paint(); }
  }
  form.onsubmit = event => {
    event.preventDefault();
    const f = form.elements;
    if (!f.allDay.checked && f.start.value >= f.end.value) { feedback.textContent = "La hora final debe ser posterior a la inicial."; return; }
    if (f.kind.value === "weekly" && f.dateUntil.value && f.dateUntil.value < f.dateFrom.value) { feedback.textContent = "La fecha final debe ser posterior o igual a la inicial."; return; }
    requestId ||= crypto.randomUUID();
    if (records.some(r => r.id === requestId)) { feedback.textContent = "Este bloqueo ya está guardado. Usa Reintentar en la lista."; requestId = null; return; }
    run({ action: "create", id: requestId, block: { kind: f.kind.value, weekday: Number(f.weekday.value), dateFrom: f.dateFrom.value, dateUntil: f.dateUntil.value, allDay: f.allDay.checked, start: f.start.value, end: f.end.value, reason: f.reason.value } });
  };
  list.onclick = event => { const button = event.target.closest("button[data-action]"); if (button) run({ action: button.dataset.action, id: button.dataset.id }); };
  modal.querySelector("[data-all]")?.addEventListener("change", event => subscribe(event.target.checked));
  subscribe(); updateInputs(); modal.querySelector("[data-close]").focus();
  stopAuth = onAuthStateChanged(getAuth(db.app), user => {
    if (String(user?.email || "").toLowerCase() !== email) { busy = false; close(); }
  });
  return close;
}
