import asyncio
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import health, reviews, theme


async def _cleanup_temp_loop() -> None:
    """Delete temp dirs and ZIPs older than 7 days — every 6 hours."""
    while True:
        await asyncio.sleep(6 * 3600)
        cutoff = datetime.now() - timedelta(days=7)
        try:
            for path in settings.temp_path.iterdir():
                mtime = datetime.fromtimestamp(path.stat().st_mtime)
                if mtime >= cutoff:
                    continue
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                elif path.is_file() and path.suffix == ".zip":
                    path.unlink(missing_ok=True)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    cleanup_task = asyncio.create_task(_cleanup_temp_loop())
    yield
    cleanup_task.cancel()


app = FastAPI(
    title="Shopify Dev Tools",
    description="Loox Review Generator + Shopify Theme Customizer",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded review images
import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(health.router)
app.include_router(reviews.router, prefix="/api")
app.include_router(theme.router)
