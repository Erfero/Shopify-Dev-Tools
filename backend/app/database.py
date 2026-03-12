"""Unified async database layer — supports SQLite (local) and PostgreSQL (production).

Configuration via environment variable DATABASE_URL:
  - Not set → SQLite at ./data/shopify_tools.db  (local dev)
  - postgresql+asyncpg:// → PostgreSQL via asyncpg (production)

Tables:
  - review_sessions  (for loox review generator CSV storage)
  - review_history   (for loox review generator history)
  - theme_history    (for shopify theme customizer history)
"""
import os
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

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

async def add_history_entry(session_id: str, product_name: str, brand_name: str, review_count: int) -> None:
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
                    review_count = :review_count, status = 'pending', downloaded_at = NULL
                WHERE session_id = :session_id
                """),
                {"product_name": product_name, "brand_name": brand_name,
                 "review_count": review_count, "session_id": session_id},
            )
        else:
            await conn.execute(
                text("""
                INSERT INTO review_history (session_id, product_name, brand_name, review_count, status)
                VALUES (:session_id, :product_name, :brand_name, :review_count, 'pending')
                """),
                {"session_id": session_id, "product_name": product_name,
                 "brand_name": brand_name, "review_count": review_count},
            )


async def mark_downloaded(session_id: str) -> None:
    now_expr = "datetime('now')" if _IS_SQLITE else "NOW()"
    async with _engine.begin() as conn:
        await conn.execute(
            text(f"UPDATE review_history SET status = 'downloaded', downloaded_at = {now_expr} WHERE session_id = :session_id"),
            {"session_id": session_id},
        )


async def get_all_history() -> list[dict]:
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT session_id, product_name, brand_name, review_count, status, created_at, downloaded_at FROM review_history ORDER BY created_at DESC")
        )
        return [
            {
                "sessionId": row[0],
                "productName": row[1],
                "brandName": row[2],
                "reviewCount": row[3],
                "status": row[4],
                "createdAt": str(row[5]),
                "downloadedAt": str(row[6]) if row[6] else None,
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
            text("INSERT INTO theme_history (id, filename, store_name, created_at, zip_path) VALUES (:id, :filename, :store_name, :created_at, :zip_path)"),
            entry,
        )


async def theme_history_list() -> list[dict]:
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, filename, store_name, created_at, zip_path FROM theme_history ORDER BY created_at DESC")
        )
        return [dict(row._mapping) for row in result]


async def theme_history_get(history_id: str) -> dict | None:
    async with _engine.connect() as conn:
        result = await conn.execute(
            text("SELECT id, filename, store_name, created_at, zip_path FROM theme_history WHERE id = :id"),
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
