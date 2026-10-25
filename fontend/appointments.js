/* MEDIC CARE – My Appointment page */

/* ---------- Data ---------- */
// To use real photos, add  photo: "images/dr-name.jpg"  to a doctor below.
const DOCTORS = [
  { id: "celestia",  name: "Dr. Celestia Santos", spec: "OB GYN",     skin: "#8a5a3c", hair: "#1d1410", style: "bun"   },
  { id: "rich",      name: "Dr. Rich Reyes",      spec: "PEDIATRICS", skin: "#d9a982", hair: "#3a2a20", style: "short" },
  { id: "sebastian", name: "Dr. Sebastian Reed",  spec: "CARDIOLOGY", skin: "#e6bd9a", hair: "#9a9a9a", style: "short" },
  { id: "mich",      name: "Dr. Mich Collins",    spec: "OB GYN",     skin: "#e8c3a0", hair: "#14100d", style: "long"  },
  { id: "ana",       name: "Dr. Ana Lim",         spec: "DERMATOLOGY", skin: "#dcae88", hair: "#241a14", style: "long"  },
  { id: "paolo",     name: "Dr. Paolo Cruz",      spec: "GENERAL MEDICINE", skin: "#c99772", hair: "#1d1612", style: "short" },
];

const SLOTS = ["8:00AM - 9:00AM", "9:00AM - 10:00AM", "10:00AM - 11:00AM", "11:00AM - 12:00PM",
               "1:00PM - 2:00PM", "2:00PM - 3:00PM", "3:00PM - 4:00PM"];   // doctors are available 8:00 AM - 4:00 PM

// Appointments are saved per account, so they stay when you move between pages.
const appointments = Auth.getAppointments();
let nextId = appointments.reduce((n, a) => Math.max(n, a.id), 0) + 1;
const save = () => Auth.saveAppointments(appointments);

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const monthNames = () => (window.I18N ? I18N.months() : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
const docById = (id) => DOCTORS.find((d) => d.id === id);
// Doctors from the booking page are stored by name; give them a plain avatar
const SKINS = ["#8a5a3c", "#d9a982", "#e6bd9a", "#e8c3a0", "#dcae88", "#c99772"];
function docOf(a) {
  const known = docById(a.doctor);
  if (known) return known;
  const name = a.doctorName || "Doctor";
  const n = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return { id: name, name, spec: a.spec || "", skin: SKINS[n % SKINS.length], hair: "#241a14", style: n % 2 ? "short" : "long" };
}
const docKey = (a) => a.doctor || a.doctorName;

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${monthNames()[m - 1]} ${d}, ${y}`;
}
function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Render ---------- */
function render() {
  const grid = $("grid");
  if (!appointments.length) {
    grid.innerHTML = `<p class="empty">${t("appt.empty")}</p>`;
    return;
  }
  grid.innerHTML = appointments.map((a) => {
    const d = docOf(a);
    const status = a.status.toLowerCase();
    const off = (status === "cancelled" || status === "completed" || Auth.recordState(a) === "Completed") ? "disabled" : "";
    return `
    <article class="card ${status}" data-id="${a.id}">
      <div class="card-top">
        <div>
          <h3 class="doc-name">${d.name}</h3>
          <p class="doc-spec">(${d.spec})</p>
        </div>
        <span class="badge ${status}">${(window.I18N ? I18N.status(a.status) : a.status)}</span>
      </div>
      <div class="info">
        <div><small>${t("appt.date")}</small>${fmtDate(a.date)}</div>
        <div><small>${t("appt.time")}</small>${a.time}</div>
      </div>
      <div class="card-actions">
        <button class="link-reschedule" data-act="resched" ${off}>${t("appt.resched")}</button>
        <button class="link-cancel" data-act="cancel" ${off}>${t("appt.cancel")}</button>
      </div>
    </article>`;
  }).join("");
}

/* ---------- Sidebar (shared, see auth.js) ---------- */
const { setSidebar } = Auth.initSidebar();

/* ---------- Modals ---------- */
function openModal(id) { $(id).hidden = false; }
function closeModals() { document.querySelectorAll(".modal").forEach((m) => (m.hidden = true)); }
document.querySelectorAll(".modal").forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeModals(); });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModals(); setSidebar(false); }
});

function fillSlots(select, selected) {
  select.innerHTML = SLOTS.map((s) => `<option${s === selected ? " selected" : ""}>${s}</option>`).join("");
}
function isTaken(doctor, date, time, ignoreId) {   // a date + time can only be booked once
  return appointments.some((a) => a.id !== ignoreId && a.date === date && a.time === time && a.status !== "Cancelled");
}

/* ----- Reschedule & Cancel (opened from cards) ----- */
let activeId = null;
$("grid").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn || btn.disabled) return;
  activeId = Number(btn.closest(".card").dataset.id);
  const a = appointments.find((x) => x.id === activeId);
  const d = docOf(a);
  if (btn.dataset.act === "resched") {
    $("reschWho").textContent = t("resch.who", { name: d.name, spec: d.spec, date: fmtDate(a.date), time: a.time });
    $("reschDate").min = todayISO();
    $("reschDate").value = a.date;
    fillSlots($("reschTime"), a.time);
    $("reschError").textContent = "";
    openModal("reschModal");
  } else {
    $("cancelWho").textContent = t("cancel.who", { name: d.name, spec: d.spec, date: fmtDate(a.date), time: a.time });
    openModal("cancelModal");
  }
});

$("reschConfirm").addEventListener("click", () => {
  const a = appointments.find((x) => x.id === activeId);
  const date = $("reschDate").value, time = $("reschTime").value;
  if (!date) return ($("reschError").textContent = t("err.newdate"));
  if (date < todayISO()) return ($("reschError").textContent = t("err.past"));
  if (isTaken(docKey(a), date, time, a.id)) return ($("reschError").textContent = t("err.taken"));
  a.date = date; a.time = time;
  save();
  render();
  closeModals();
  toast(t("toast.rescheduled"));
});

$("cancelConfirm").addEventListener("click", () => {
  const a = appointments.find((x) => x.id === activeId);
  a.status = "Cancelled";
  save();
  render();
  closeModals();
  toast(t("toast.cancelled"));
});

render();

// Old links to "?book=1" now go straight to the booking page
if (new URLSearchParams(location.search).get("book") === "1") location.replace("booking.html");
if (new URLSearchParams(location.search).get("booked") === "1") {
  toast(t("toast.booked"));
  history.replaceState(null, "", location.pathname);
}

// Re-draw cards when the language changes
window.addEventListener("langchange", render);
