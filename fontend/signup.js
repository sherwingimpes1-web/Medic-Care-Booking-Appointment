/* MEDIC CARE – Sign up page */
const $ = (id) => document.getElementById(id);
const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);
const fields = { id: ["emailOrPhone", "idMsg"], pw: ["password", "pwMsg"], cf: ["confirmPassword", "cfMsg"] };

function setErr(key, msg) {
  const [inputId, msgId] = fields[key];
  $(msgId).textContent = msg || "";
  $(inputId).classList.toggle("invalid", !!msg);
}
const clearAll = () => Object.keys(fields).forEach((k) => setErr(k, ""));
Object.values(fields).forEach(([inputId]) => $(inputId).addEventListener("input", clearAll));

$("signupForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("emailOrPhone").value, pw = $("password").value, cf = $("confirmPassword").value;
  let eId = "", ePw = "", eCf = "";

  if (!Auth.validId(id)) eId = t("sig.err.id");

  if (pw.length < 8) ePw = t("sig.err.len");
  else if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) ePw = t("sig.err.mix");

  if (!cf) eCf = t("sig.err.cf");
  else if (!ePw && pw !== cf) eCf = t("sig.err.match");

  setErr("id", eId); setErr("pw", ePw); setErr("cf", eCf);
  if (eId || ePw || eCf) { $(eId ? fields.id[0] : ePw ? fields.pw[0] : fields.cf[0]).focus(); return; }

  const res = Auth.createUser(id, pw);
  if (!res.ok) {
    const msg = { exists: "sig.err.exists", invalid_id: "sig.err.id", weak_password: "sig.err.len", network: "sig.err.network" }[res.error] || "sig.err.server";
    setErr("id", t(msg)); $(fields.id[0]).focus(); return;
  }

  location.href = "index.html?created=1";
});

window.addEventListener("langchange", clearAll);
