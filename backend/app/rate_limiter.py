"""Simple in-memory rate limiter — no extra dependencies required."""
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, HTTPException

# { ip: [timestamps] }  — cleaned up on each call
_buckets: dict[str, list[float]] = defaultdict(list)


def make_limiter(max_calls: int, window_seconds: int = 60) -> Callable:
    """Return a FastAPI dependency that limits `max_calls` per `window_seconds` per IP."""

    def _limit(request: Request) -> None:
        ip = (request.client.host if request.client else "unknown")
        now = time.monotonic()
        cutoff = now - window_seconds
        calls = [t for t in _buckets[ip] if t > cutoff]
        if len(calls) >= max_calls:
            raise HTTPException(
                status_code=429,
                detail=f"Trop de requêtes — maximum {max_calls} par {window_seconds}s. Réessayez dans un moment.",
            )
        calls.append(now)
        _buckets[ip] = calls

    return _limit


# Pre-built limiters used by routers
upload_limiter   = make_limiter(max_calls=20, window_seconds=60)   # 20 uploads/min
generate_limiter = make_limiter(max_calls=5,  window_seconds=60)   # 5 generations/min (heavy — up to 50 products each)
