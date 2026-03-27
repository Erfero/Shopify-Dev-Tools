import asyncio
import logging
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, cleanup_old_output_zips
from app.routers import health, reviews, theme
from app.routers.theme import evict_expired_sessions
from app.routers.auth_users import router as auth_router
from app.routers.admin_analytics import router as admin_analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def _cleanup_temp_loop() -> None:
    """Delete temp dirs and ZIPs older than 30 days — every 6 hours."""
    while True:
        await asyncio.sleep(6 * 3600)
        cutoff = datetime.now() - timedelta(days=30)
        try:
            for path in settings.temp_path.iterdir():
                try:
                    mtime = datetime.fromtimestamp(path.stat().st_mtime)
                except OSError:
                    continue
                if mtime >= cutoff:
                    continue
                try:
                    if path.is_dir():
                        shutil.rmtree(path, ignore_errors=True)
                        logger.info("Cleanup: removed session dir %s", path.name)
                    elif path.is_file() and path.suffix == ".zip":
                        path.unlink(missing_ok=True)
                        logger.info("Cleanup: removed ZIP %s", path.name)
                except Exception as e:
                    logger.warning("Cleanup: failed to delete %s: %s", path, e)
        except Exception as e:
            logger.error("Cleanup loop error: %s", e)
        try:
            deleted = await cleanup_old_output_zips(days=5)
            if deleted:
                logger.info("Cleanup: removed %d expired output ZIP(s) from DB", deleted)
        except Exception as e:
            logger.error("Output ZIP cleanup error: %s", e)
        try:
            evicted = evict_expired_sessions()
            if evicted:
                logger.info("Cleanup: evicted %d expired theme session(s) from memory", evicted)
        except Exception as e:
            logger.error("Session eviction error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # Warn if API_TOKEN is not set — all endpoints are publicly accessible
    if not settings.api_token:
        logger.warning(
            "⚠️  API_TOKEN is not set — all endpoints are publicly accessible. "
            "Set the API_TOKEN environment variable in production."
        )
    else:
        logger.info("✅ API_TOKEN configured — endpoints protected.")

    cleanup_task = asyncio.create_task(_cleanup_temp_loop())
    yield
    cleanup_task.cancel()


app = FastAPI(
    title="Shopify Dev Tools",
    description="Loox Review Generator + Shopify Theme Customizer",
    version="1.0.0",
    lifespan=lifespan,
)

def _build_origins() -> list[str]:
    origins = {
        "http://localhost:3000",
        "http://localhost:3001",
        "https://shopify-dev-tools.vercel.app",
    }
    if settings.frontend_url:
        origins.add(settings.frontend_url)
    for o in settings.cors_origins.split(","):
        o = o.strip()
        if o:
            origins.add(o)
    return list(origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded review images
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(health.router)
app.include_router(auth_router)
app.include_router(admin_analytics_router)
app.include_router(reviews.router, prefix="/api")
app.include_router(theme.router)
