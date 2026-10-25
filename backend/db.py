"""MEDIC CARE - database layer (Supabase / PostgreSQL).

Lahat ng database access ay nandito lang. Kumokonekta sa Supabase gamit ang
DATABASE_URL (Supabase -> Connect -> "Session pooler" connection string).

Mga table (may "mc_" prefix para hindi mabangga ang ibang table mo sa Supabase):
    mc_users      -> id (email/phone), password hash, profile (name/email/phone/code/photo)
    mc_user_data  -> per-account key/value (appointments, profileExtra, ...)
"""
import json
import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

PROFILE_FIELDS = ("name", "email", "phone", "code", "photo")

_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not set. Paste your Supabase 'Session pooler' connection string "
                "into the DATABASE_URL environment variable."
            )
        _pool = ConnectionPool(
            url,
            min_size=1,
            max_size=5,
            timeout=20,
            open=True,
            check=ConnectionPool.check_connection,                       # drop dead connections
            kwargs={"row_factory": dict_row, "prepare_threshold": None},  # prepare_threshold=None: works with Supabase pooler
        )
    return _pool


def _conn():
    return _get_pool().connection()      # commits on success, rolls back on error


def init_db():
    with _conn() as c:
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


def get_user(uid):
    with _conn() as c:
        return c.execute("SELECT * FROM mc_users WHERE id = %s", (uid,)).fetchone()


def create_user(uid, pw_hash, profile):
    """Returns False if the account already exists."""
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO mc_users (id, pw_hash, name, email, phone, code, photo) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
            (uid, pw_hash, profile["name"], profile["email"], profile["phone"],
             profile["code"], profile["photo"]),
        )
        return cur.rowcount == 1


def update_profile(uid, patch):
    fields = {k: str(v) for k, v in patch.items() if k in PROFILE_FIELDS}
    if not fields:
        return
    sets = ", ".join(f"{k} = %s" for k in fields)          # keys come from PROFILE_FIELDS only
    with _conn() as c:
        c.execute(f"UPDATE mc_users SET {sets} WHERE id = %s", (*fields.values(), uid))


def set_password_hash(uid, pw_hash):
    with _conn() as c:
        c.execute("UPDATE mc_users SET pw_hash = %s WHERE id = %s", (pw_hash, uid))


def delete_user(uid):
    with _conn() as c:
        c.execute("DELETE FROM mc_users WHERE id = %s", (uid,))   # mc_user_data goes with it (CASCADE)


def get_all_data(uid):
    with _conn() as c:
        rows = c.execute("SELECT key, value FROM mc_user_data WHERE user_id = %s", (uid,)).fetchall()
    return {r["key"]: r["value"] for r in rows}


def set_data(uid, key, value):
    with _conn() as c:
        c.execute(
            "INSERT INTO mc_user_data (user_id, key, value) VALUES (%s, %s, %s::jsonb) "
            "ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value",
            (uid, key, json.dumps(value)),
        )
