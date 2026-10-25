/* MEDIC CARE – Medical History page */

/* ---------- Data ----------
   Empty for now. When pages are connected, fill this array (or load it from your backend).
   Record shape:
   { id, type: "consultation" | "lab" | "prescription", date: "2026-10-24",
     doctor: "Dr. Name", specialty: "Pediatrics", photo: "images/dr.jpg" (optional),
     diagnosis: "Acute Tonsillitis", status: "Completed" | "Pending" | "Cancelled", notes: "optional" }
*/
// Records come straight from the appointments, so booking / rescheduling / cancelling shows up here automatically.
const DOCS = { celestia: ["Dr. Celestia Santos", "OB GYN"], rich: ["Dr. Rich Reyes", "PEDIATRICS"], sebastian: ["Dr. Sebastian Reed", "CARDIOLOGY"],
               mich: ["Dr. Mich Collins", "OB GYN"], ana: ["Dr. Ana Lim", "DERMATOLOGY"], paolo: ["Dr. Paolo Cruz", "GENERAL MEDICINE"] };
const pretty = (s) => String(s || "").toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
function loadRecords() {
  return Auth.getAppointments().map((a) => {
    const known = DOCS[a.doctor];
    const specific = a.specific || "";
    return {
      id: a.id,
      type: /lab|ultrasound/i.test(specific) ? "lab" : "consultation",
      date: a.date,
      doctor: known ? known[0] : (a.doctorName || "Doctor"),
      specialty: known ? known[1] : (a.spec || ""),
      diagnosis: specific ? pretty(specific) : (a.service || "—"),
      status: a.status === "Completed" ? "Completed" : a.status,
      state: Auth.recordState(a),          // Pending | Cancelled | Completed
      notes: a.time ? "Time: " + a.time : ""
    };
  });
}
let records = loadRecords();

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const monthNames = () => (window.I18N ? I18N.months() : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
const statusLabel = (s) => (window.I18N ? I18N.status(s) : s);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${monthNames()[m - 1]} ${d}, ${y}`;
}
function initials(name) {
  return name.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/* ---------- State ---------- */
let activeType = "all";
let sortDir = "desc"; // newest first

/* ---------- Render ---------- */
function render() {
  const list = records
    .filter((r) => activeType === "all" || r.type === activeType)
    .sort((a, b) => (sortDir === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  const body = $("records");
  if (!list.length) {
    body.innerHTML = `<div class="empty-state"><div><strong>${t("empty.title", { label: t("lbl." + activeType) })}</strong>${t("empty.body", { label: t("lbl." + activeType) })}</div></div>`;
    return;
  }
  body.innerHTML = list.map((r) => `
    <div class="row-item" role="row">
      <div class="r-date">${esc(fmtDate(r.date))}</div>
      <div class="r-doc">
        <div class="avatar">${r.photo ? `<img src="${esc(r.photo)}" alt="${esc(r.doctor)}">` : esc(initials(r.doctor))}</div>
        <div><p class="r-name">${esc(r.doctor)}</p><p class="r-spec">${esc(r.specialty)}</p></div>
      </div>
      <div class="r-diag">${esc(r.diagnosis)}</div>
      <div class="r-status"><span class="status ${esc((r.state === "Completed" ? "Completed" : r.status).toLowerCase())}">${esc(statusLabel(r.state === "Completed" ? "Completed" : r.status))}</span></div>
      <div class="r-action"><span class="action-note ${esc(r.state.toLowerCase())}">${esc(statusLabel(r.state))}</span></div>
    </div>`).join("");
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    activeType = tab.dataset.type;
    render();
  });
});

/* ---------- Sort ---------- */
const sortBtn = $("sortDate");
sortBtn.dataset.dir = sortDir;
sortBtn.addEventListener("click", () => {
  sortDir = sortDir === "desc" ? "asc" : "desc";
  sortBtn.dataset.dir = sortDir;
  render();
});

/* ---------- Details modal ---------- */
$("records").addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-details");
  if (!btn) return;
  const r = records.find((x) => String(x.id) === btn.dataset.id);
  if (!r) return;
  $("detailsBody").innerHTML = `
    <dt>${t("th.date")}</dt><dd>${esc(fmtDate(r.date))}</dd>
    <dt>${t("det.doctor")}</dt><dd>${esc(r.doctor)} (${esc(r.specialty)})</dd>
    <dt>${t("th.diag")}</dt><dd>${esc(r.diagnosis)}</dd>
    <dt>${t("th.status")}</dt><dd>${esc(statusLabel(r.status))}</dd>
    <dt>${t("det.notes")}</dt><dd>${esc(r.notes || t("det.nonotes"))}</dd>`;
  $("detailsModal").hidden = false;
});

function closeModals() { document.querySelectorAll(".modal").forEach((m) => (m.hidden = true)); }
document.querySelectorAll(".modal").forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeModals(); });
});

/* ---------- Sidebar (shared, see auth.js) ---------- */
const { setSidebar } = Auth.initSidebar();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModals(); setSidebar(false); }
});

render();

// Re-draw the table when the language changes
window.addEventListener("langchange", render);
