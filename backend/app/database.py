"""Unified async database layer — supports SQLite (local) and PostgreSQL (production).

Configuration via environment variable DATABASE_URL:
  - Not set → SQLite at ./data/shopify_tools.db  (local dev)
  - postgresql+asyncpg:// → PostgreSQL via asyncpg (production)

Tables:
  - review_sessions  (for loox review generator CSV storage)
  - review_history   (for loox review generator history)
  - theme_history    (for shopify theme customizer history)
"""
import logging
import os
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

_logger = logging.getLogger(__name__)

# ── Engine setup ──────────────────────────────────────────────────────────────

_DATABASE_URL = os.getenv("DATABASE_URL", "")

# Normalize Postgres URLs and strip unsupported query params for asyncpg
_connect_args: dict = {}
if _DATABASE_URL:
    # Convert URL scheme to asyncpg
    if _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif _DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in _DATABASE_URL:
        _DATABASE_URL = _DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Strip SSL/channel_binding params from URL — pass via connect_args instead
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    parsed = urlparse(_DATABASE_URL)
    params = parse_qs(parsed.query)
    ssl_mode = params.pop("sslmode", ["require"])[0]
    params.pop("channel_binding", None)
    clean_query = urlencode({k: v[0] for k, v in params.items()})
    _DATABASE_URL = urlunparse(parsed._replace(query=clean_query))
    if ssl_mode in ("require", "verify-ca", "verify-full"):
        _connect_args["ssl"] = "require"

if not _DATABASE_URL:
    _db_path = Path("./data/shopify_tools.db")
    _db_path.parent.mkdir(parents=True, exist_ok=True)
    _DATABASE_URL = f"sqlite+aiosqlite:///{_db_path}"
    _IS_SQLITE = True
    _connect_args = {"check_same_thread": False}
else:
    _IS_SQLITE = False

_engine: AsyncEngine = create_async_engine(
    _DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)

# ── Schema ────────────────────────────────────────────────────────────────────

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS review_sessions (
    session_id   TEXT PRIMARY KEY,
    full_csv     TEXT NOT NULL,
    import_csv   TEXT NOT NULL,
    review_count INTEGER,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL,
    product_name TEXT,
    brand_name   TEXT,
    review_count INTEGER,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT (datetime('now')),
    downloaded_at TEXT
);

CREATE TABLE IF NOT EXISTS theme_history (
    id         TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    store_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    zip_path   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS theme_upload_cache (
    session_id TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    zip_data   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme_output_cache (
    history_id TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    zip_data   TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theme_analytics (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id           TEXT,
    store_name           TEXT,
    language             TEXT,
    product_count        INTEGER,
    has_images           INTEGER,
    duration_seconds     REAL,
    success              INTEGER,
    sections_regenerated INTEGER DEFAULT 0,
    created_at           TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_approved   INTEGER DEFAULT 0,
    is_admin      INTEGER DEFAULT 0,
    display_name  TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    action     TEXT NOT NULL,
    details    TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

_CREATE_TABLES_PG = """
CREATE TABLE IF NOT EXISTS review_sessions (
    session_id   TEXT PRIMARY KEY,
    full_csv     TEXT NOT NULL,
    import_csv   TEXT NOT NULL,
    review_count INTEGER,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_history (
    id           SERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,
    product_name TEXT,
    brand_name   TEXT,
    review_count INTEGER,
    status       TEXT DEFAULT 'pending',
    created_at   TIMESTAMP DEFAULT NOW(),
    downloaded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS theme_history (
    id         TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    store_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    zip_path   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS theme_upload_cache (
    session_id TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    zip_data   TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theme_output_cache (
    history_id TEXT PRIMARY KEY,
    filename   TEXT NOT NULL,
    zip_data   TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS theme_analytics (
    id                   SERIAL PRIMARY KEY,
    session_id           TEXT,
    store_name           TEXT,
    language             TEXT,
    product_count        INTEGER,
    has_images           BOOLEAN,
    duration_seconds     REAL,
    success              BOOLEAN,
    sections_regenerated INTEGER DEFAULT 0,
    created_at           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_approved   BOOLEAN DEFAULT FALSE,
    is_admin      BOOLEAN DEFAULT FALSE,
    display_name  TEXT DEFAULT '',
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
    id         SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    action     TEXT NOT NULL,
    details    TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
"""


# ── Init ──────────────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create all tables if they don't exist."""
    ddl = _CREATE_TABLES_PG if not _IS_SQLITE else _CREATE_TABLES
    async with _engine.begin() as conn:
        for stmt in ddl.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                await conn.execute(text(stmt))
    await _migrate_add_columns()


# ── Review session functions ───────────────────────────────────────────────────

async def save_session(session_id: str, full_csv: str, import_csv: str, review_count: int) -> None:
    async with _engine.begin() as conn:
        if _IS_SQLITE:
            await conn.execute(
                text("""
                INSERT INTO review_sessions (session_id, full_csv, import_csv, review_count)
                VALUES (:session_id, :full_csv, :import_csv, :review_count)
                ON CONFLICT(session_id) DO UPDATE SET
                    full_csv = excluded.full_csv,
                    import_csv = excluded.import_csv,
                    review_count = excluded.review_count
                """),
                {"session_id": session_id, "full_csv": full_csv, "import_csv": import_csv, "review_count": review_count},
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO review_sessions (session_id, full_csv, import_csv, review_count)
                VALUES (:session_id, :full_csv, :import_csv, :review_count)
                ON CONFLICT(session_id) DO UPDATE SET
                    full_csv = EXCLUDED.full_csv,
                    import_csv = EXCLUDED.import_csv,
                    review_count = EXCLUDED.review_count
                """),
                {"session_id": session_id, "full_csv": full_csv, "import_csv": import_csv, "review_count": review_count},
            )


async def get_session(session_id: str) -> dict | None:
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT full_csv, import_csv, review_count FROM review_sessions WHERE session_id = :session_id"),
            {"session_id": session_id},
        )
        row = result.fetchone()
    if row is None:
        return None
    return {"full_csv": row[0], "import_csv": row[1], "review_count": row[2]}


# ── Review history functions ───────────────────────────────────────────────────

async def add_history_entry(session_id: str, product_name: str, brand_name: str, review_count: int, user_email: str = "inconnu") -> None:
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("SELECT id FROM review_history WHERE session_id = :session_id"),
            {"session_id": session_id},
        )
        existing = result.fetchone()
        if existing:
            await conn.execute(
                text("""
                UPDATE review_history
                SET product_name = :product_name, brand_name = :brand_name,
                    review_count = :review_count, status = 'pending', downloaded_at = NULL,
                    user_email = :user_email
                WHERE session_id = :session_id
                """),
                {"product_name": product_name, "brand_name": brand_name,
                 "review_count": review_count, "session_id": session_id, "user_email": user_email},
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO review_history (session_id, product_name, brand_name, review_count, status, user_email)
                VALUES (:session_id, :product_name, :brand_name, :review_count, 'pending', :user_email)
                """),
                {"session_id": session_id, "product_name": product_name,
                 "brand_name": brand_name, "review_count": review_count, "user_email": user_email},
            )


async def mark_downloaded(session_id: str) -> None:
    now_expr = "datetime('now')" if _IS_SQLITE else "NOW()"
    async with _engine.begin() as conn:
        await conn.execute(
            text(f"UPDATE review_history SET status = 'downloaded', downloaded_at = {now_expr} WHERE session_id = :session_id"),
            {"session_id": session_id},
        )


async def get_all_history(user_email: str | None = None) -> list[dict]:
    q = "SELECT session_id, product_name, brand_name, review_count, status, created_at, downloaded_at, user_email FROM review_history"
    params: dict = {}
    if user_email:
        q += " WHERE user_email = :email"
        params["email"] = user_email
    q += " ORDER BY created_at DESC"
    async with _engine.connect() as conn:
        result = await conn.execute(text(q), params)
        return [
            {
                "sessionId": row[0],
                "productName": row[1],
                "brandName": row[2],
                "reviewCount": row[3],
                "status": row[4],
                "createdAt": str(row[5]),
                "downloadedAt": str(row[6]) if row[6] else None,
                "userEmail": row[7] if row[7] else "inconnu",
            }
            for row in result
        ]


async def delete_review_history(session_id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM review_history WHERE session_id = :session_id"),
            {"session_id": session_id},
        )
        await conn.execute(
            text("DELETE FROM review_sessions WHERE session_id = :session_id"),
            {"session_id": session_id},
        )


# ── Theme history functions ────────────────────────────────────────────────────

async def theme_history_add(entry: dict) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO theme_history (id, filename, store_name, created_at, zip_path, user_email) VALUES (:id, :filename, :store_name, :created_at, :zip_path, :user_email)"),
            entry,
        )


async def theme_history_list(user_email: str | None = None) -> list[dict]:
    q = "SELECT id, filename, store_name, created_at, zip_path, user_email FROM theme_history"
    params: dict = {}
    if user_email:
        q += " WHERE user_email = :email"
        params["email"] = user_email
    q += " ORDER BY created_at DESC"
    async with _engine.connect() as conn:
        result = await conn.execute(text(q), params)
        return [dict(row._mapping) for row in result]


async def theme_history_get(history_id: str) -> dict | None:
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, filename, store_name, created_at, zip_path, user_email FROM theme_history WHERE id = :id"),
            {"id": history_id},
        )
        row = result.fetchone()
    return dict(row._mapping) if row else None


async def theme_history_delete(history_id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM theme_history WHERE id = :id"), {"id": history_id})


async def theme_history_clear() -> None:
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM theme_history"))


# ── Theme upload cache (survive server restarts on Render) ────────────────────

async def save_theme_zip(session_id: str, filename: str, zip_bytes: bytes) -> None:
    """Store the original ZIP in the DB so sessions can be rebuilt after restart."""
    import base64
    zip_b64 = base64.b64encode(zip_bytes).decode("ascii")
    async with _engine.begin() as conn:
        if _IS_SQLITE:
            await conn.execute(
                text("""
                INSERT INTO theme_upload_cache (session_id, filename, zip_data)
                VALUES (:sid, :fn, :data)
                ON CONFLICT(session_id) DO UPDATE SET filename=excluded.filename, zip_data=excluded.zip_data
                """),
                {"sid": session_id, "fn": filename, "data": zip_b64},
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO theme_upload_cache (session_id, filename, zip_data)
                VALUES (:sid, :fn, :data)
                ON CONFLICT(session_id) DO UPDATE SET filename=EXCLUDED.filename, zip_data=EXCLUDED.zip_data
                """),
                {"sid": session_id, "fn": filename, "data": zip_b64},
            )


async def get_theme_zip(session_id: str) -> tuple[str, bytes] | None:
    """Retrieve ZIP bytes from the DB cache. Returns (filename, zip_bytes) or None."""
    import base64
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT filename, zip_data FROM theme_upload_cache WHERE session_id = :sid"),
            {"sid": session_id},
        )
        row = result.fetchone()
    if row is None:
        return None
    return row[0], base64.b64decode(row[1])


async def delete_theme_zip(session_id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM theme_upload_cache WHERE session_id = :sid"),
            {"sid": session_id},
        )


# ── Theme output ZIP cache (survive server restarts — 5-day retention) ────────

async def save_theme_output_zip(history_id: str, filename: str, zip_bytes: bytes) -> None:
    """Store the generated output ZIP so it survives server restarts."""
    import base64
    zip_b64 = base64.b64encode(zip_bytes).decode("ascii")
    async with _engine.begin() as conn:
        if _IS_SQLITE:
            await conn.execute(
                text("""
                INSERT INTO theme_output_cache (history_id, filename, zip_data)
                VALUES (:hid, :fn, :data)
                ON CONFLICT(history_id) DO UPDATE SET filename=excluded.filename, zip_data=excluded.zip_data
                """),
                {"hid": history_id, "fn": filename, "data": zip_b64},
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO theme_output_cache (history_id, filename, zip_data)
                VALUES (:hid, :fn, :data)
                ON CONFLICT(history_id) DO UPDATE SET filename=EXCLUDED.filename, zip_data=EXCLUDED.zip_data
                """),
                {"hid": history_id, "fn": filename, "data": zip_b64},
            )


async def get_theme_output_zip(history_id: str) -> tuple[str, bytes] | None:
    """Retrieve the generated ZIP from DB. Returns (filename, zip_bytes) or None."""
    import base64
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT filename, zip_data FROM theme_output_cache WHERE history_id = :hid"),
            {"hid": history_id},
        )
        row = result.fetchone()
    if row is None:
        return None
    return row[0], base64.b64decode(row[1])


async def delete_theme_output_zip(history_id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM theme_output_cache WHERE history_id = :hid"),
            {"hid": history_id},
        )


async def clear_all_theme_output_zips() -> None:
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM theme_output_cache"))


async def list_theme_output_zip_ids() -> set:
    """Return set of history_ids that have a cached output ZIP."""
    async with _engine.connect() as conn:
        result = await conn.execute(text("SELECT history_id FROM theme_output_cache"))
        return {row[0] for row in result}


async def cleanup_old_output_zips(days: int = 5) -> int:
    """Delete output ZIPs older than `days` days. Returns count deleted."""
    if _IS_SQLITE:
        cutoff_expr = f"datetime('now', '-{days} days')"
        stmt = f"DELETE FROM theme_output_cache WHERE created_at < {cutoff_expr}"
    else:
        stmt = f"DELETE FROM theme_output_cache WHERE created_at < NOW() - INTERVAL '{days} days'"
    async with _engine.begin() as conn:
        result = await conn.execute(text(stmt))
        return result.rowcount


# ── Theme analytics functions ─────────────────────────────────────────────────

async def analytics_record(
    session_id: str,
    store_name: str,
    language: str,
    product_count: int,
    has_images: bool,
    duration_seconds: float,
    success: bool,
) -> None:
    """Insert a new analytics record after a generation completes."""
    async with _engine.begin() as conn:
        if _IS_SQLITE:
            await conn.execute(
                text("""
                INSERT INTO theme_analytics
                    (session_id, store_name, language, product_count, has_images, duration_seconds, success)
                VALUES (:sid, :store, :lang, :pc, :hi, :dur, :ok)
                """),
                {
                    "sid": session_id, "store": store_name, "lang": language,
                    "pc": product_count, "hi": int(has_images),
                    "dur": duration_seconds, "ok": int(success),
                },
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO theme_analytics
                    (session_id, store_name, language, product_count, has_images, duration_seconds, success)
                VALUES (:sid, :store, :lang, :pc, :hi, :dur, :ok)
                """),
                {
                    "sid": session_id, "store": store_name, "lang": language,
                    "pc": product_count, "hi": has_images,
                    "dur": duration_seconds, "ok": success,
                },
            )


async def analytics_increment_regen(session_id: str) -> None:
    """Increment the sections_regenerated counter for a session."""
    async with _engine.begin() as conn:
        await conn.execute(
            text("""
            UPDATE theme_analytics
            SET sections_regenerated = sections_regenerated + 1
            WHERE session_id = :sid
            """),
            {"sid": session_id},
        )


async def analytics_get_summary() -> dict:
    """Return aggregated analytics summary."""
    async with _engine.connect() as conn:
        row = await conn.execute(
            text("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
                AVG(duration_seconds) as avg_duration,
                SUM(sections_regenerated) as total_regen
            FROM theme_analytics
            """)
        )
        r = row.fetchone()

        lang_rows = await conn.execute(
            text("""
            SELECT language, COUNT(*) as cnt
            FROM theme_analytics
            GROUP BY language
            ORDER BY cnt DESC
            """)
        )
        by_language = {lr[0] or "unknown": lr[1] for lr in lang_rows}

    total = r[0] or 0
    successful = r[1] or 0
    avg_duration = round(r[2] or 0, 1)
    total_regen = r[3] or 0

    return {
        "total": total,
        "successful": successful,
        "success_rate": round((successful / total * 100) if total > 0 else 0, 1),
        "avg_duration": avg_duration,
        "by_language": by_language,
        "total_regenerations": total_regen,
    }


# ── User auth functions ────────────────────────────────────────────────────────

async def create_user(id: str, email: str, password_hash: str, is_approved: bool, is_admin: bool, display_name: str = "") -> None:
    async with _engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO users (id, email, password_hash, is_approved, is_admin, display_name) VALUES (:id, :email, :password_hash, :is_approved, :is_admin, :display_name)"),
            {"id": id, "email": email, "password_hash": password_hash, "is_approved": bool(is_approved), "is_admin": bool(is_admin), "display_name": display_name},
        )


async def get_user_by_email(email: str) -> dict | None:
    async with _engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT id, email, password_hash, is_approved, is_admin, created_at, display_name FROM users WHERE email = :email"),
            {"email": email},
        )).fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "password_hash": row[2], "is_approved": bool(row[3]), "is_admin": bool(row[4]), "created_at": str(row[5]), "display_name": row[6] or ""}


async def get_user_by_id(id: str) -> dict | None:
    async with _engine.connect() as conn:
        row = (await conn.execute(
            text("SELECT id, email, password_hash, is_approved, is_admin, created_at, display_name FROM users WHERE id = :id"),
            {"id": id},
        )).fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "password_hash": row[2], "is_approved": bool(row[3]), "is_admin": bool(row[4]), "created_at": str(row[5]), "display_name": row[6] or ""}


async def get_all_users() -> list[dict]:
    async with _engine.connect() as conn:
        rows = (await conn.execute(
            text("SELECT id, email, is_approved, is_admin, created_at, display_name FROM users ORDER BY created_at DESC")
        )).fetchall()
    return [{"id": r[0], "email": r[1], "is_approved": bool(r[2]), "is_admin": bool(r[3]), "created_at": str(r[4]), "display_name": r[5] or ""} for r in rows]


async def update_user_status(id: str, is_approved: bool | None = None, is_admin: bool | None = None) -> None:
    parts = []
    params: dict = {"id": id}
    if is_approved is not None:
        parts.append("is_approved = :is_approved")
        params["is_approved"] = bool(is_approved)
    if is_admin is not None:
        parts.append("is_admin = :is_admin")
        params["is_admin"] = bool(is_admin)
    if not parts:
        return
    async with _engine.begin() as conn:
        await conn.execute(text(f"UPDATE users SET {', '.join(parts)} WHERE id = :id"), params)


async def delete_user(id: str) -> None:
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": id})


async def update_user_profile(user_id: str, display_name: str | None = None, password_hash: str | None = None) -> None:
    parts = []
    params: dict = {"id": user_id}
    if display_name is not None:
        parts.append("display_name = :display_name")
        params["display_name"] = display_name
    if password_hash is not None:
        parts.append("password_hash = :password_hash")
        params["password_hash"] = password_hash
    if not parts:
        return
    async with _engine.begin() as conn:
        await conn.execute(text(f"UPDATE users SET {', '.join(parts)} WHERE id = :id"), params)


# ── Display name helper ────────────────────────────────────────────────────────

import re as _re

def _display_name_from_email(email: str) -> str:
    """Derive a human-readable display name from an email address.
    e.g. erferokamers@gmail.com  → Erferokamers
         john.doe@gmail.com      → John Doe
         mary_jane123@gmail.com  → Mary Jane
    """
    local = email.split("@")[0]
    local = _re.sub(r'\d+$', '', local)          # strip trailing numbers
    parts = _re.split(r'[._\-]', local)          # split on . _ -
    parts = [p.capitalize() for p in parts if p]
    return " ".join(parts) if parts else local.capitalize()


# ── Activity log functions ─────────────────────────────────────────────────────

async def _migrate_add_columns() -> None:
    """Add missing columns to existing tables — each in its own transaction.

    IMPORTANT: on PostgreSQL, a failed statement in a transaction puts the whole
    transaction in 'aborted' state.  Running each ALTER TABLE in a separate
    _engine.begin() block ensures one failure never poisons the others.
    """
    migrations = [
        "ALTER TABLE theme_history ADD COLUMN user_email TEXT DEFAULT 'inconnu'",
        "ALTER TABLE review_history ADD COLUMN user_email TEXT DEFAULT 'inconnu'",
        "ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''",
    ]
    for stmt in migrations:
        try:
            async with _engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass  # Column already exists — this transaction is rolled back; others continue

    # Populate display_name for existing users who don't have one
    try:
        async with _engine.begin() as conn:
            rows = (await conn.execute(
                text("SELECT id, email FROM users WHERE display_name IS NULL OR display_name = ''")
            )).fetchall()
            for row in rows:
                dn = _display_name_from_email(row[1])
                await conn.execute(
                    text("UPDATE users SET display_name = :dn WHERE id = :id"),
                    {"dn": dn, "id": row[0]},
                )
    except Exception as e:
        _logger.warning("display_name population skipped: %s", e)


async def log_activity(user_email: str, action: str, details: str | None = None, ip_address: str | None = None) -> None:
    """Log a user action to the activity log."""
    try:
        async with _engine.begin() as conn:
            await conn.execute(
                text("INSERT INTO activity_log (user_email, action, details, ip_address) VALUES (:email, :action, :details, :ip)"),
                {"email": user_email, "action": action, "details": details, "ip": ip_address},
            )
    except Exception as e:
        _logger.warning("Failed to log activity (%s / %s): %s", user_email, action, e)


async def get_my_action_counts(user_email: str) -> dict:
    """Counts per action type for a single user — no pagination limit."""
    async with _engine.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT action, COUNT(*) as cnt FROM activity_log WHERE user_email = :email GROUP BY action"
        ), {"email": user_email})).fetchall()
    return {r[0]: r[1] for r in rows}


async def get_activity_log(limit: int = 200, user_email: str | None = None, offset: int = 0, actions: list[str] | None = None) -> list[dict]:
    base = (
        "SELECT a.id, a.user_email, COALESCE(NULLIF(u.display_name,''), a.user_email) as display_name, "
        "a.action, a.details, a.ip_address, a.created_at "
        "FROM activity_log a LEFT JOIN users u ON a.user_email = u.email"
    )
    params: dict = {}
    conditions = []
    if user_email:
        conditions.append("a.user_email = :email")
        params["email"] = user_email
    if actions:
        placeholders = ", ".join(f":a{i}" for i in range(len(actions)))
        conditions.append(f"a.action IN ({placeholders})")
        for i, act in enumerate(actions):
            params[f"a{i}"] = act
    if conditions:
        base += " WHERE " + " AND ".join(conditions)
    base += " ORDER BY a.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    async with _engine.connect() as conn:
        rows = (await conn.execute(text(base), params)).fetchall()
    return [{"id": r[0], "user_email": r[1], "display_name": r[2], "action": r[3], "details": r[4], "ip_address": r[5], "created_at": str(r[6])} for r in rows]


async def get_activity_stats() -> dict:
    """Aggregated stats for admin dashboard."""
    async with _engine.connect() as conn:
        # Total actions per action type
        rows = (await conn.execute(text(
            "SELECT action, COUNT(*) as cnt FROM activity_log GROUP BY action ORDER BY cnt DESC"
        ))).fetchall()
        by_action = {r[0]: r[1] for r in rows}

        # Activity per day (last 14 days)
        if _IS_SQLITE:
            daily_rows = (await conn.execute(text(
                "SELECT DATE(created_at) as day, COUNT(*) as cnt FROM activity_log "
                "WHERE created_at >= DATE('now', '-14 days') GROUP BY day ORDER BY day"
            ))).fetchall()
        else:
            daily_rows = (await conn.execute(text(
                "SELECT DATE(created_at) as day, COUNT(*) as cnt FROM activity_log "
                "WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day"
            ))).fetchall()
        by_day = [{"date": str(r[0]), "count": r[1]} for r in daily_rows]

        # Top users by activity
        top_rows = (await conn.execute(text(
            "SELECT a.user_email, COUNT(*) as cnt, COALESCE(NULLIF(MAX(u.display_name),''), a.user_email) as display_name "
            "FROM activity_log a LEFT JOIN users u ON u.email = a.user_email "
            "GROUP BY a.user_email ORDER BY cnt DESC LIMIT 10"
        ))).fetchall()
        top_users = [{"email": r[0], "count": r[1], "display_name": r[2]} for r in top_rows]

        # Active users (last 15 min)
        if _IS_SQLITE:
            active_rows = (await conn.execute(text(
                "SELECT DISTINCT user_email FROM activity_log "
                "WHERE created_at >= DATETIME('now', '-15 minutes')"
            ))).fetchall()
        else:
            active_rows = (await conn.execute(text(
                "SELECT DISTINCT user_email FROM activity_log "
                "WHERE created_at >= NOW() - INTERVAL '15 minutes'"
            ))).fetchall()
        active_users = [r[0] for r in active_rows]

        # Theme generations per user
        theme_rows = (await conn.execute(text(
            "SELECT a.user_email, COUNT(*) as cnt, COALESCE(NULLIF(MAX(u.display_name),''), a.user_email) as display_name "
            "FROM activity_log a LEFT JOIN users u ON u.email = a.user_email "
            "WHERE a.action = 'theme_generate' GROUP BY a.user_email ORDER BY cnt DESC"
        ))).fetchall()
        themes_by_user = [{"email": r[0], "count": r[1], "display_name": r[2]} for r in theme_rows]

        # CSV generations per user
        csv_rows = (await conn.execute(text(
            "SELECT a.user_email, COUNT(*) as cnt, COALESCE(NULLIF(MAX(u.display_name),''), a.user_email) as display_name "
            "FROM activity_log a LEFT JOIN users u ON u.email = a.user_email "
            "WHERE a.action = 'csv_generate' GROUP BY a.user_email ORDER BY cnt DESC"
        ))).fetchall()
        csv_by_user = [{"email": r[0], "count": r[1], "display_name": r[2]} for r in csv_rows]

        # Theme language breakdown from theme_analytics table
        try:
            theme_lang_rows = (await conn.execute(text(
                "SELECT language, COUNT(*) as cnt FROM theme_analytics "
                "WHERE language IS NOT NULL AND language != '' "
                "GROUP BY language ORDER BY cnt DESC LIMIT 10"
            ))).fetchall()
            themes_by_language = [{"language": r[0], "count": r[1]} for r in theme_lang_rows]
        except Exception:
            themes_by_language = []

        # Review language breakdown from activity_log details JSON
        try:
            if _IS_SQLITE:
                review_lang_rows = (await conn.execute(text(
                    "SELECT json_extract(details, '$.language') as lang, COUNT(*) as cnt "
                    "FROM activity_log WHERE action = 'csv_generate' AND details IS NOT NULL "
                    "AND json_extract(details, '$.language') IS NOT NULL "
                    "GROUP BY lang ORDER BY cnt DESC LIMIT 10"
                ))).fetchall()
            else:
                review_lang_rows = (await conn.execute(text(
                    "SELECT t.lang, COUNT(*) as cnt FROM ("
                    "  SELECT (details::jsonb)->>'language' as lang FROM activity_log "
                    "  WHERE action = 'csv_generate' AND details IS NOT NULL"
                    ") t WHERE t.lang IS NOT NULL GROUP BY t.lang ORDER BY cnt DESC LIMIT 10"
                ))).fetchall()
            reviews_by_language = [{"language": r[0], "count": r[1]} for r in review_lang_rows]
        except Exception:
            reviews_by_language = []

    return {
        "by_action": by_action,
        "by_day": by_day,
        "top_users": top_users,
        "active_users": active_users,
        "themes_by_user": themes_by_user,
        "csv_by_user": csv_by_user,
        "themes_by_language": themes_by_language,
        "reviews_by_language": reviews_by_language,
        "total": sum(by_action.values()),
    }
