/* MEDIC CARE – shared accounts, login session and sidebar.
   Ang account/login/data ay nasa Python backend na (backend/app.py), hindi na sa localStorage.
   Same pa rin ang mga function (Auth.createUser, Auth.verify, Auth.login, ...) kaya hindi
   kailangang galawin ang ibang pages.

   FAST LOADING (new): the signed-in account is also kept in this tab's sessionStorage. A page
   opens instantly from that copy and checks with the server in the background, so moving
   between pages no longer waits for the server. Only the first page in a tab (or after
   login) asks the server and waits.

   Paano gumagana:
     - Pag-load ng page, isang beses kukunin ang session + profile + data sa /api/me (cache).
     - Reads (profile, getData, getAppointments...) galing sa cache -> instant.
     - Writes at password checks diretso sa server (synchronous request, para pareho pa rin
       ang behavior ng dating functions). Pwede itong gawing async later kung gusto.

   Page rules (put on the <html> tag):
     data-requires-login  → visitors who are not signed in are sent to index.html
     data-guest-only      → signed-in users are sent to homepage.html                       */
(function () {
  const LOGIN = "index.html", HOME = "homepage.html";
  const API = "/api";

  /* ---------- Server calls ---------- */
  function call(method, path, body) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, API + path, false);                       // synchronous on purpose (see note above)
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(body === undefined ? null : JSON.stringify(body));
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch (e) {}
      return { status: xhr.status, data };
    } catch (e) {
      return { status: 0, data: { ok: false, error: "network" } };
    }
  }

  /* ---------- Cache of the signed-in account ---------- */
  const root = document.documentElement;
  const CACHE_KEY = "mcMe";
  let cache = null;                                              // { id, profile, data } or null
  let writes = 0;                                                // counts saves, so a late background check can't overwrite them

  function readSaved() { try { const s = sessionStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function writeSaved() {
    try { cache ? sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)) : sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
  }

  // Blocking check (only used when this tab has no saved copy yet)
  function refresh() {
    const r = call("GET", "/me");
    if (r.status === 200) { cache = r.data.user || null; writeSaved(); }   // on a server error keep what we had
    else if (!cache) writeSaved();
  }

  // Background check: never blocks the page
  function revalidate() {
    const startedAt = writes;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", API + "/me");
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText || "{}"); } catch (e) {}
        if (xhr.status !== 200 || !data) return;               // server problem: keep using the saved copy
        const user = data.user || null;
        if (!user) {                                           // the login really ended
          cache = null; writeSaved();
          if (root.hasAttribute("data-requires-login")) location.replace(LOGIN);
          return;
        }
        if (root.hasAttribute("data-guest-only")) { cache = user; writeSaved(); location.replace(HOME); return; }
        if (writes === startedAt) { cache = user; writeSaved(); hydrateSidebar(); }   // fresh data (skipped if you saved something meanwhile)
      };
      xhr.send();
    } catch (e) {}
  }

  cache = readSaved();
  if (cache) revalidate();                                       // open instantly from the saved copy
  else if (root.hasAttribute("data-guest-only")) revalidate();   // login / sign-up page: don't make the visitor wait
  else refresh();                                                // first page of this tab: we must know who is signed in

  /* ---------- Email / phone ---------- */
  function normalize(raw) {
    let s = String(raw || "").trim();
    if (s.includes("@")) return s.toLowerCase();
    s = s.replace(/[\s\-().]/g, "");
    if (/^\+63\d{10}$/.test(s)) s = "0" + s.slice(3);        // +63 917… → 0917…
    else if (/^63\d{10}$/.test(s)) s = "0" + s.slice(2);
    return s;
  }
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const isPhone = (v) => /^\+?\d{7,15}$/.test(v);
  const validId = (raw) => { const n = normalize(raw); return isEmail(n) || isPhone(n); };

  /* ---------- Accounts ---------- */
  function nameFromId(n) {
    if (!isEmail(n)) return "Patient";
    const words = n.split("@")[0].split(/[._\-+0-9]+/).filter(Boolean);
    return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "Patient";
  }
  function defaultProfile(n) {
    return { name: nameFromId(n), email: isEmail(n) ? n : "", phone: isEmail(n) ? "" : n, code: "+63", photo: "" };
  }

  function createUser(raw, pw) {
    const r = call("POST", "/signup", { id: raw, password: pw });
    if (r.data && r.data.ok) return { ok: true, id: r.data.id };
    // "exists" / "invalid_id" / "weak_password" come from the server; anything else is a server or network problem
    const error = (r.data && r.data.error) || (r.status === 0 ? "network" : "server");
    return { ok: false, error, status: r.status };
  }
  function verify(raw, pw) {
    const r = call("POST", "/verify", { id: raw, password: pw });
    if (r.data && r.data.ok) return { ok: true, id: r.data.id };
    if (r.status === 0) return { ok: false, reason: "network" };
    if (r.status >= 500) return { ok: false, reason: "server" };
    return { ok: false, reason: (r.data && r.data.reason) || "bad" };
  }

  const current = () => (cache ? cache.id : null);
  function login(raw) { call("POST", "/login", { id: raw }); refresh(); }
  function logout() { call("POST", "/logout"); cache = null; writeSaved(); }

  const profile = () => (cache ? { ...defaultProfile(cache.id), ...cache.profile } : defaultProfile(""));
  function saveProfile(patch) {
    if (!cache) return null;
    const r = call("PUT", "/profile", patch);
    writes++;
    if (r.data && r.data.ok) { cache.profile = r.data.profile; writeSaved(); }
    return null;
  }
  const checkPassword = (pw) => { if (!cache) return false; const r = call("POST", "/password/check", { password: pw }); return !!(r.data && r.data.ok); };
  const setPassword = (pw) => { if (cache) call("PUT", "/password", { password: pw }); };
  function deleteAccount() { if (!cache) return; call("DELETE", "/account"); cache = null; writeSaved(); }

  // Per-account data (appointments, records…)
  function getData(key, fallback) {
    return cache && cache.data && key in cache.data ? cache.data[key] : fallback;
  }
  function setData(key, value) {
    if (!cache) return null;
    cache.data = cache.data || {};
    cache.data[key] = value;
    writes++;
    writeSaved();
    call("PUT", "/data/" + encodeURIComponent(key), { value });
    return null;
  }

  /* ---------- Appointments (shared by Appointment, Booking and Medical History pages) ---------- */
  // New accounts start with no appointments
  const getAppointments = () => getData("appointments", []).map((a) => (a.status === "Pending" ? { ...a, status: "Confirmed" } : a));
  const saveAppointments = (list) => setData("appointments", list);
  const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  // Cancelled stays Cancelled; a visit whose date has passed counts as Completed; everything else is Confirmed
  function recordState(a) {
    if (a.status === "Cancelled") return "Cancelled";
    if (a.status === "Completed" || (a.status === "Confirmed" && a.date < todayISO())) return "Completed";
    return "Confirmed";
  }

  /* ---------- Page guard (runs immediately) ---------- */
  if (root.hasAttribute("data-requires-login") && !current()) location.replace(LOGIN);
  else if (root.hasAttribute("data-guest-only") && current()) location.replace(HOME);

  /* ---------- Sidebar (shared by every signed-in page) ---------- */
  function hydrateSidebar() {
    const $ = (id) => document.getElementById(id);
    if (!$("sideName")) return;
    const p = profile();
    $("sideName").textContent = p.name || "Patient";
    $("sideEmail").textContent = p.email || p.phone || "";
    const av = $("sideAvatar");
    av.textContent = "";
    if (p.photo) { const img = document.createElement("img"); img.src = p.photo; img.alt = ""; av.appendChild(img); }
    else av.textContent = ((p.name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase();
  }

  function initSidebar() {
    const $ = (id) => document.getElementById(id);
    const sidebar = $("sidebar"), scrim = $("scrim"), menuBtn = $("menuBtn");
    function setSidebar(open) {
      sidebar.classList.toggle("open", open);
      scrim.classList.toggle("open", open);
      sidebar.setAttribute("aria-hidden", String(!open));
      menuBtn.setAttribute("aria-expanded", String(open));
    }
    menuBtn.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
    $("closeSidebar").addEventListener("click", () => setSidebar(false));
    scrim.addEventListener("click", () => setSidebar(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setSidebar(false); });

    $("navSearch").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll("#nav a").forEach((a) => {
        const match = a.textContent.toLowerCase().includes(q);
        a.hidden = !match;
        if (match) shown++;
      });
      $("noMatch").hidden = shown > 0;
    });

    const out = document.querySelector(".logout");
    if (out) out.addEventListener("click", logout);       // then the link takes the user to index.html

    hydrateSidebar();
    return { setSidebar };
  }

  window.Auth = {
    normalize, isEmail, isPhone, validId, createUser, verify, current, login, logout,
    profile, saveProfile, checkPassword, setPassword, deleteAccount, getData, setData,
    initSidebar, hydrateSidebar, getAppointments, saveAppointments, recordState, todayISO, LOGIN, HOME
  };
})();
