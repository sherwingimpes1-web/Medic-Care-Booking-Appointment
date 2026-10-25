/* MEDIC CARE – Settings page (Account Settings) */

const $ = (id) => document.getElementById(id);
const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const { setSidebar } = Auth.initSidebar();      // sidebar, search, profile and logout live in auth.js

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, type) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("success", type === "success");
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------- Modals ---------- */
function openModal(id) { $(id).hidden = false; }
function closeModals() { document.querySelectorAll(".modal").forEach((m) => (m.hidden = true)); }
document.querySelectorAll(".modal").forEach((m) => {
  m.addEventListener("click", (e) => { if (e.target === m || e.target.hasAttribute("data-close")) closeModals(); });
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

/* ---------- Language ---------- */
const langSelect = $("langSelect");
langSelect.value = window.I18N ? I18N.getLang() : "en";
langSelect.addEventListener("change", () => {
  if (window.I18N) I18N.setLang(langSelect.value);   // changes every page of the website
  toast(t("lang.changed"));
});

/* ---------- Change password ---------- */
function setErr(inputId, errId, msg) {
  $(errId).textContent = msg;
  $(inputId).closest(".input-box").classList.toggle("invalid", !!msg);
}
function clearPwErrors() {
  setErr("currentPw", "errCurrent", "");
  setErr("newPw", "errNew", "");
  setErr("confirmPw", "errConfirm", "");
}

$("pwForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const cur = $("currentPw").value, pw = $("newPw").value, conf = $("confirmPw").value;
  let eCur = "", eNew = "", eConf = "";

  if (!cur) eCur = t("pw.err.current.empty");
  else if (!Auth.checkPassword(cur)) eCur = t("pw.err.current.wrong");

  if (!pw) eNew = t("pw.err.new.empty");
  else if (pw.length < 8) eNew = t("pw.err.new.len");
  else if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) eNew = t("pw.err.new.mix");
  else if (!eCur && pw === cur) eNew = t("pw.err.new.same");

  if (!conf) eConf = t("pw.err.confirm.empty");
  else if (!eNew && pw !== conf) eConf = t("pw.err.confirm.match");

  setErr("currentPw", "errCurrent", eCur);
  setErr("newPw", "errNew", eNew);
  setErr("confirmPw", "errConfirm", eConf);
  if (eCur || eNew || eConf) {
    $(eCur ? "currentPw" : eNew ? "newPw" : "confirmPw").focus();
    return;
  }

  Auth.setPassword(pw);               // replace with a call to your backend when you have one
  $("pwForm").reset();
  toast(t("pw.success"), "success");
});
["currentPw", "newPw", "confirmPw"].forEach((id) => $(id).addEventListener("input", clearPwErrors));

/* ---------- Forgot password ---------- */
$("forgotBtn").addEventListener("click", () => {
  const p = Auth.profile();
  $("forgotEmail").value = p.email || "";
  setErr("forgotEmail", "errForgot", "");
  openModal("forgotModal");
  $("forgotEmail").focus();
});
$("forgotSend").addEventListener("click", () => {
  const email = $("forgotEmail").value.trim();
  if (!Auth.isEmail(email)) return setErr("forgotEmail", "errForgot", t("forgot.err"));
  // TODO: ask your backend to email a reset link to `email`
  closeModals();
  toast(t("forgot.sent", { email }));
});
$("forgotEmail").addEventListener("input", () => setErr("forgotEmail", "errForgot", ""));

/* ---------- Delete account ---------- */
$("deleteBtn").addEventListener("click", () => openModal("deleteModal"));
$("deleteConfirm").addEventListener("click", () => {
  Auth.deleteAccount();               // removes the account, its saved data and the login session
  closeModals();
  toast(t("del.done"), "success");
  setTimeout(() => { window.location.href = Auth.LOGIN; }, 1600);
});

/* ---------- Language changed (here or in another tab) ---------- */
window.addEventListener("langchange", () => {
  if (window.I18N) langSelect.value = I18N.getLang();
  clearPwErrors();
  setErr("forgotEmail", "errForgot", "");
});
