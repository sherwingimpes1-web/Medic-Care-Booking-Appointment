"""MEDIC CARE - Python (Flask) backend.

Pinalitan nito ang "backend" na dating nasa auth.js (localStorage). Same functions pa rin:
create user, verify, login, logout, profile, save profile, check/set password,
delete account, per-account data (appointments, profileExtra, ...).

Run:
    pip install -r requirements.txt
    python app.py          ->  http://localhost:5000
"""
import os
import re
import secrets
import time
import traceback
from datetime import timedelta

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash

import db

BASE = os.path.dirname(os.path.abspath(__file__))
def _find_frontend():
    """The website files: <repo>/frontend (normal). Also accepts the misspelled folder name
    <repo>/fontend, and backend/frontend, so a typo in the folder name can't break the site."""
    options = [
        os.path.abspath(os.path.join(BASE, "..", "frontend")),
        os.path.abspath(os.path.join(BASE, "..", "fontend")),
        os.path.join(BASE, "frontend"),
    ]
    for p in options:
        if os.path.isfile(os.path.join(p, "index.html")):
            return p
    print("WARNING: frontend/index.html not found. Looked in: " + ", ".join(options), flush=True)
    return options[0]


FRONTEND = _find_frontend()


def _secret_key():
    """Use SECRET_KEY from env; otherwise create one and keep it so logins survive restarts."""
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    path = os.path.join(BASE, ".secret_key")
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(secrets.token_hex(32))
    with open(path) as f:
        return f.read().strip()


app = Flask(__name__, static_folder=FRONTEND, static_url_path="")
app.config.update(
    SECRET_KEY=_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE") == "1",   # set COOKIE_SECURE=1 on HTTPS
    PERMANENT_SESSION_LIFETIME=timedelta(days=30),
    MAX_CONTENT_LENGTH=5 * 1024 * 1024,                              # profile photo is a data URL
)

@app.errorhandler(Exception)
def on_error(e):
    """Anything unexpected (e.g. the database is unreachable) is logged for the Render logs
    (traceback only - never passwords) and returned as JSON, so the website can tell it apart
    from a real "account already exists" answer (HTTP 409)."""
    if isinstance(e, HTTPException):
        return e
    app.logger.exception("Unhandled error on %s %s", request.method, request.path)
    if request.path.startswith("/api/"):
        return jsonify(ok=False, error="server"), 500
    return "Server error", 500


@app.before_request
def _start_timer():
    g.t0 = time.perf_counter()


@app.after_request
def _log_api_timing(resp):
    """One line per API call in the Render logs, e.g.  [req] POST /api/signup -> 200 in 2310ms
    so you can see exactly which call is slow."""
    t0 = g.get("t0")
    if t0 is not None and request.path.startswith("/api/"):
        print(f"[req] {request.method} {request.path} -> {resp.status_code} in {(time.perf_counter() - t0) * 1000:.0f}ms", flush=True)
    return resp


PW_VERIFIED_WINDOW = 300          # seconds: how long a "checkPassword" stays valid for setPassword
DATA_KEY = re.compile(r"^[A-Za-z0-9_.\-]{1,64}$")


# ---------------------------------------------------------------- helpers (ported from auth.js)
def normalize(raw):
    s = str(raw or "").strip()
    if "@" in s:
        return s.lower()
    s = re.sub(r"[\s\-().]", "", s)
    if re.fullmatch(r"\+63\d{10}", s):
        s = "0" + s[3:]
    elif re.fullmatch(r"63\d{10}", s):
        s = "0" + s[2:]
    return s


def is_email(v):
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", v))


def is_phone(v):
    return bool(re.fullmatch(r"\+?\d{7,15}", v))


def valid_id(raw):
    n = normalize(raw)
    return is_email(n) or is_phone(n)


def name_from_id(n):
    if not is_email(n):
        return "Patient"
    words = [w for w in re.split(r"[._\-+0-9]+", n.split("@")[0]) if w]
    return " ".join(w[0].upper() + w[1:] for w in words) or "Patient"


def default_profile(n):
    email = is_email(n)
    return {
        "name": name_from_id(n),
        "email": n if email else "",
        "phone": "" if email else n,
        "code": "+63",
        "photo": "",
    }


def password_error(pw):
    if not isinstance(pw, str) or len(pw) < 8:
        return "len"
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw):
        return "mix"
    return None


def body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def current():
    """Signed-in account id from the signed login cookie. No database call here (this used to cost
    one extra query on EVERY request). /api/me checks that the account still exists."""
    return session.get("uid")


def profile_of(user):
    return {k: user[k] for k in db.PROFILE_FIELDS}


def login_required(fn):
    from functools import wraps

    @wraps(fn)
    def wrapper(*a, **kw):
        uid = current()
        if not uid:
            return jsonify(ok=False, error="unauthorized"), 401
        return fn(uid, *a, **kw)

    return wrapper


# ---------------------------------------------------------------- API
@app.post("/api/signup")                       # Auth.createUser(raw, pw)
def signup():
    d = body()
    uid = normalize(d.get("id"))
    pw = d.get("password")
    if not valid_id(uid):
        return jsonify(ok=False, error="invalid_id"), 400
    if password_error(pw):
        return jsonify(ok=False, error="weak_password"), 400
    if not db.create_user(uid, generate_password_hash(pw), default_profile(uid)):
        return jsonify(ok=False, error="exists"), 409
    return jsonify(ok=True, id=uid)


@app.post("/api/verify")                       # Auth.verify(raw, pw)
def verify():
    d = body()
    uid = normalize(d.get("id"))
    pw = d.get("password") or ""
    user = db.get_user(uid)
    if not user:
        return jsonify(ok=False, reason="none")
    if not check_password_hash(user["pw_hash"], pw):
        return jsonify(ok=False, reason="bad")
    session["pending"] = uid                    # password proven; Auth.login(id) finishes the sign-in
    return jsonify(ok=True, id=uid)


@app.post("/api/login")                        # Auth.login(raw)
def login():
    uid = normalize(body().get("id"))
    if not uid or session.get("pending") != uid:          # the signed cookie proves /verify succeeded
        return jsonify(ok=False, error="verify_first"), 403
    session.clear()
    session["uid"] = uid
    session.permanent = True
    return jsonify(ok=True)


@app.post("/api/logout")                       # Auth.logout()
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")                            # loaded once per page by auth.js
def me():
    uid = current()
    if not uid:
        return jsonify(user=None)                       # not signed in: answers instantly, no database
    acct = db.get_account(uid)                          # user + saved data in a single query
    if not acct:                                        # account was deleted
        session.clear()
        return jsonify(user=None)
    return jsonify(user={"id": uid, "profile": profile_of(acct), "data": acct["data"]})


@app.put("/api/profile")                       # Auth.saveProfile(patch)
@login_required
def save_profile(uid):
    patch = body()
    for k in ("name", "email", "phone", "code"):
        if k in patch and len(str(patch[k])) > 200:
            return jsonify(ok=False, error="too_long"), 400
    row = db.update_profile(uid, patch)
    if not row:
        session.clear()
        return jsonify(ok=False, error="unauthorized"), 401
    return jsonify(ok=True, profile=profile_of(row))


@app.post("/api/password/check")               # Auth.checkPassword(pw)
@login_required
def password_check(uid):
    user = db.get_user(uid)
    if not user:
        session.clear()
        return jsonify(ok=False, error="unauthorized"), 401
    ok = check_password_hash(user["pw_hash"], body().get("password") or "")
    if ok:
        session["pw_verified_at"] = time.time()
    return jsonify(ok=ok)


@app.put("/api/password")                      # Auth.setPassword(pw)
@login_required
def password_set(uid):
    # same flow as the old UI: checkPassword(current) first, then setPassword(new)
    if time.time() - session.get("pw_verified_at", 0) > PW_VERIFIED_WINDOW:
        return jsonify(ok=False, error="verify_current_password"), 403
    pw = body().get("password")
    if password_error(pw):
        return jsonify(ok=False, error="weak_password"), 400
    db.set_password_hash(uid, generate_password_hash(pw))
    session.pop("pw_verified_at", None)
    return jsonify(ok=True)


@app.delete("/api/account")                    # Auth.deleteAccount()
@login_required
def delete_account(uid):
    db.delete_user(uid)
    session.clear()
    return jsonify(ok=True)


@app.put("/api/data/<key>")                    # Auth.setData(key, value)  (appointments live here too)
@login_required
def set_data(uid, key):
    if not DATA_KEY.match(key):
        return jsonify(ok=False, error="bad_key"), 400
    d = body()
    if "value" not in d:
        return jsonify(ok=False, error="missing_value"), 400
    if not db.set_data(uid, key, d["value"]):
        session.clear()
        return jsonify(ok=False, error="unauthorized"), 401
    return jsonify(ok=True)


# ---------------------------------------------------------------- website
@app.get("/")
def root():
    return send_from_directory(FRONTEND, "index.html")


@app.get("/healthz")                           # instant, never touches the database: point a keep-awake monitor here
def healthz():
    return "ok", 200


@app.get("/api/health")                        # open this in a browser to see how fast the database answers
def health():
    t0 = time.perf_counter()
    try:
        db.ping()
        return jsonify(ok=True, db_ms=round((time.perf_counter() - t0) * 1000))
    except Exception as e:                      # only the error TYPE is shown, never the connection string
        app.logger.exception("Health check: database unreachable")
        return jsonify(ok=False, error=type(e).__name__, after_ms=round((time.perf_counter() - t0) * 1000)), 503


try:
    db.init_db()
except Exception:                               # don't crash the whole site if the database is briefly unreachable
    print("WARNING: db.init_db() failed at startup; continuing (tables probably exist already):", flush=True)
    traceback.print_exc()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=os.environ.get("DEBUG") == "1")
