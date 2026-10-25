"""MEDIC CARE - database layer (Supabase / PostgreSQL).

Lahat ng database access ay nandito lang. Kumokonekta sa Supabase gamit ang
DATABASE_URL (Supabase -> Connect -> pooler connection string).

Mga table (may "mc_" prefix para hindi mabangga ang ibang table mo sa Supabase):
    mc_users      -> id (email/phone), password hash, profile (name/email/phone/code/photo)
    mc_user_data  -> per-account key/value (appointments, profileExtra, ...)

What changed for speed / reliability:
  * connect_timeout + a shorter pool wait, so a database that can't be reached fails in
    ~10 seconds instead of hanging until the web server gives up at 60 seconds
  * get_account() reads the user AND all saved data in ONE query (it was 3 before)
  * update_profile() returns the updated row, so no second query is needed
  * any database call slower than 1 second is printed in the Render logs, with how much of
    that time was spent just getting a connection
  * the startup table check can no longer hang forever on a database lock
"""
import json
import os
import threading
import time
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PROFILE_FIELDS = ("name", "email", "phone", "code", "photo")
SLOW_DB_SECONDS = 1.0

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                url = os.environ.get("DATABASE_URL")
                if not url:
                    raise RuntimeError(
                        "DATABASE_URL is not set. Paste your Supabase pooler connection string "
                        "into the DATABASE_URL environment variable."
                    )
                pool = ConnectionPool(
                    url,
                    min_size=1,
                    max_size=3,              # 2 web workers x 3 = 6 connections max (Supabase pooler has limits)
                    timeout=10,              # max seconds a request waits for a free connection
                    max_idle=300,            # close connections idle for 5 min (the pooler drops idle ones anyway)
                    max_lifetime=1800,
                    open=False,
                    check=ConnectionPool.check_connection,                 # drop dead connections
                    kwargs={
                        "row_factory": dict_row,
                        "prepare_threshold": None,                         # needed for Supabase pooler
                        "connect_timeout": 10,                             # fail fast instead of hanging
                    },
                )
                pool.open()                  # starts connecting in the background, does not block
                _pool = pool
    return _pool


@contextmanager
def _conn(label):
    """One transaction: commits on success, rolls back on error. Logs it if it was slow."""
    t0 = time.perf_counter()
    with _get_pool().connection() as c:
        waited = time.perf_counter() - t0
        yield c
    total = time.perf_counter() - t0
    if total >= SLOW_DB_SECONDS:
        print(f"[db] slow: {label} took {total:.2f}s (getting a connection: {waited:.2f}s)", flush=True)


def init_db():
    with _conn("init_db") as c:
        c.execute("SET LOCAL lock_timeout = '5s'")            # never wait forever on a lock at startup
        c.execute("SELECT pg_advisory_xact_lock(727274)")     # several workers may start at once
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS mc_users (
                id         TEXT PRIMARY KEY,                   -- normalized email or phone
                pw_hash    TEXT NOT NULL,
                name       TEXT NOT NULL DEFAULT '',
                email      TEXT NOT NULL DEFAULT '',
                phone      TEXT NOT NULL DEFAULT '',
                code       TEXT NOT NULL DEFAULT '+63',
                photo      TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS mc_user_data (
                user_id TEXT NOT NULL REFERENCES mc_users(id) ON DELETE CASCADE,
                key     TEXT NOT NULL,
                value   JSONB NOT NULL,
                PRIMARY KEY (user_id, key)
            )
            """
        )
        # Supabase exposes tables in "public" through its public API. Turning on Row Level Security
        # (with no policies) blocks that API completely, so password hashes can't be read from outside.
        # This server connects as the database owner, which is not affected.
        c.execute("ALTER TABLE mc_users ENABLE ROW LEVEL SECURITY")
        c.execute("ALTER TABLE mc_user_data ENABLE ROW LEVEL SECURITY")


def ping():
    """Cheapest possible database round trip (used by /api/health)."""
    with _conn("ping") as c:
        c.execute("SELECT 1")


def get_user(uid):
    with _conn("get_user") as c:
        return c.execute("SELECT * FROM mc_users WHERE id = %s", (uid,)).fetchone()


def get_account(uid):
    """The user row plus ALL of the account's saved data, in a single query. Returns None if no such user.
    The saved data comes back as a dict in the 'data' field."""
    with _conn("get_account") as c:
        return c.execute(
            "SELECT u.*, COALESCE((SELECT jsonb_object_agg(d.key, d.value) "
            "FROM mc_user_data d WHERE d.user_id = u.id), '{}'::jsonb) AS data "
            "FROM mc_users u WHERE u.id = %s",
            (uid,),
        ).fetchone()


def create_user(uid, pw_hash, profile):
    """Returns False if the account already exists."""
    with _conn("create_user") as c:
        cur = c.execute(
            "INSERT INTO mc_users (id, pw_hash, name, email, phone, code, photo) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (uid, pw_hash, profile["name"], profile["email"], profile["phone"],
             profile["code"], profile["photo"]),
        )
        return cur.rowcount == 1


def update_profile(uid, patch):
    """Updates the allowed profile fields and returns the updated user row (None if no such user)."""
    fields = {k: str(v) for k, v in patch.items() if k in PROFILE_FIELDS}
    if not fields:
        return get_user(uid)
    sets = ", ".join(f"{k} = %s" for k in fields)          # keys come from PROFILE_FIELDS only
    with _conn("update_profile") as c:
        return c.execute(
            f"UPDATE mc_users SET {sets} WHERE id = %s RETURNING *", (*fields.values(), uid)
        ).fetchone()


def set_password_hash(uid, pw_hash):
    with _conn("set_password") as c:
        c.execute("UPDATE mc_users SET pw_hash = %s WHERE id = %s", (pw_hash, uid))


def delete_user(uid):
    with _conn("delete_user") as c:
        c.execute("DELETE FROM mc_users WHERE id = %s", (uid,))   # mc_user_data goes with it (CASCADE)


def get_all_data(uid):
    with _conn("get_all_data") as c:
        rows = c.execute("SELECT key, value FROM mc_user_data WHERE user_id = %s", (uid,)).fetchall()
    return {r["key"]: r["value"] for r in rows}


def set_data(uid, key, value):
    """Returns False if the account no longer exists (e.g. it was deleted in another tab)."""
    try:
        with _conn("set_data") as c:
            c.execute(
                "INSERT INTO mc_user_data (user_id, key, value) VALUES (%s, %s, %s::jsonb) "
                "ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value",
                (uid, key, json.dumps(value)),
            )
        return True
    except psycopg.errors.ForeignKeyViolation:
        return False
