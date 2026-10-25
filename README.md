# MEDIC CARE

Flask backend (`backend/`) + plain HTML/CSS/JS frontend (`frontend/`), saved in a Supabase (PostgreSQL) database
and hosted on Render.

## Run on your computer

    cd backend
    pip install -r requirements.txt
    set DATABASE_URL=<your Supabase Session pooler string>      (Windows: set / Mac-Linux: export)
    python app.py        # open http://localhost:5000

## Environment variables

| Name | What it is |
|---|---|
| `DATABASE_URL` | Supabase -> Connect -> **Session pooler** connection string (with your database password) |
| `SECRET_KEY` | long random text that signs login cookies (Render generates it) |
| `COOKIE_SECURE` | `1` when the site is on https (Render) |

Tables are created automatically on first start: `mc_users`, `mc_user_data` (Row Level Security is switched on).
