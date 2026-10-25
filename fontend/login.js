/* MEDIC CARE – Login page */
const $ = (id) => document.getElementById(id);
const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);

let toastT, cd = 0, timer, sentEmail = "";

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2800);
}
function show(id) { ["forgotModal", "checkModal"].forEach((m) => $(m).classList.toggle("show", m === id)); }
const hide = () => show(null);

/* ---------- Password eye ---------- */
function paintEye() {
  const visible = $("pw").type === "text";
  $("pupil").setAttribute("fill", visible ? "none" : "#444");
  $("eye").setAttribute("aria-label", t(visible ? "log.eye.hide" : "log.eye.show"));
}
$("eye").onclick = () => { $("pw").type = $("pw").type === "text" ? "password" : "text"; paintEye(); };

/* ---------- Sign in ---------- */
function clearErrors() {
  $("emailMsg").textContent = ""; $("pwMsg").textContent = "";
  $("email").classList.remove("err"); $("pw").classList.remove("err");
}
$("email").addEventListener("input", clearErrors);
$("pw").addEventListener("input", clearErrors);

$("loginForm").onsubmit = (e) => {
  e.preventDefault();
  clearErrors();
  const id = $("email").value, pw = $("pw").value;

  if (!Auth.validId(id)) { $("emailMsg").textContent = t("log.err.id"); $("email").classList.add("err"); return; }
  if (!pw) { $("pwMsg").textContent = t("log.err.pw"); $("pw").classList.add("err"); return; }

  const res = Auth.verify(id, pw);
  if (!res.ok) {
    if (res.reason === "none") { $("emailMsg").textContent = t("log.err.none"); $("email").classList.add("err"); }
    else { $("pwMsg").textContent = t("log.err.bad"); $("pw").classList.add("err"); }
    return;
  }
  Auth.login(id);
  location.href = Auth.HOME;
};

/* ---------- Forgot password ---------- */
$("forgotLink").onclick = (e) => {
  e.preventDefault();
  const typed = Auth.normalize($("email").value);
  $("fEmail").value = Auth.isEmail(typed) ? typed : "";
  $("fMsg").textContent = ""; $("fEmail").classList.remove("err");
  show("forgotModal");
  $("fEmail").focus();
};
$("backLogin").onclick = hide;

function paintCheckDesc() { $("checkDesc").textContent = t("log.c.desc", { email: sentEmail }); }

$("forgotForm").onsubmit = (e) => {
  e.preventDefault();
  const value = $("fEmail").value.trim();
  if (!Auth.isEmail(value)) { $("fMsg").textContent = t("log.f.err"); $("fEmail").classList.add("err"); return; }
  $("fEmail").classList.remove("err");
  sentEmail = value;
  paintCheckDesc();
  show("checkModal");
  startCooldown();               // connect a real password-reset service here to send the email
};

function startCooldown() {
  cd = 30;
  $("resend").disabled = true;
  clearInterval(timer);
  const tick = () => {
    $("resendTxt").textContent = cd > 0 ? t("log.c.wait", { n: cd }) : t("log.c.resend");
    if (cd <= 0) { $("resend").disabled = false; clearInterval(timer); }
    cd--;
  };
  tick();
  timer = setInterval(tick, 1000);
}
$("resend").onclick = () => {
  if ($("resend").disabled) return;
  toast(t("log.t.resend"));
  startCooldown();
};

$("openInbox").onclick = () => {
  const domain = (sentEmail.split("@")[1] || "").toLowerCase();
  const providers = {
    "gmail.com": "https://mail.google.com", "yahoo.com": "https://mail.yahoo.com",
    "outlook.com": "https://outlook.live.com", "hotmail.com": "https://outlook.live.com",
    "icloud.com": "https://www.icloud.com/mail"
  };
  window.open(providers[domain] || "mailto:", "_blank");
};

document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
document.querySelectorAll(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) hide(); }));

/* ---------- Language + "account created" message ---------- */
window.addEventListener("langchange", () => {
  paintEye();
  if ($("checkModal").classList.contains("show")) { paintCheckDesc(); startCooldown(); }
});
paintEye();
if (new URLSearchParams(location.search).get("created") === "1") {
  toast(t("log.t.created"));
  history.replaceState(null, "", location.pathname);
}
