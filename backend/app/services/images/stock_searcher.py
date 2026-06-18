"""
Stock photo search — Pexels + Unsplash APIs.
Both are free with registration. Results are deduplicated across sources.
"""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def _search_pexels(query: str, per_page: int = 12) -> list[dict]:
    if not settings.pexels_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": settings.pexels_api_key},
                params={
                    "query": query,
                    "per_page": per_page,
                    "orientation": "landscape",
                    "size": "large",
                },
            )
            r.raise_for_status()
            data = r.json()
        return [
            {
                "id": f"pexels_{p['id']}",
                "source": "Pexels",
                "url": p["src"]["large2x"],
                "thumb": p["src"]["medium"],
                "photographer": p.get("photographer", ""),
                "alt": p.get("alt", query) or query,
                "query": query,
            }
            for p in data.get("photos", [])
        ]
    except Exception as e:
        logger.warning("Pexels search failed for %r: %s", query, e)
        return []


async def _search_unsplash(query: str, per_page: int = 12) -> list[dict]:
    if not settings.unsplash_access_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                "https://api.unsplash.com/search/photos",
                headers={"Authorization": f"Client-ID {settings.unsplash_access_key}"},
                params={
                    "query": query,
                    "per_page": per_page,
                    "orientation": "landscape",
                    "content_filter": "high",
                },
            )
            r.raise_for_status()
            data = r.json()
        return [
            {
                "id": f"unsplash_{p['id']}",
                "source": "Unsplash",
                "url": p["urls"]["full"],
                "thumb": p["urls"]["small"],
                "photographer": p.get("user", {}).get("name", ""),
                "alt": p.get("alt_description", query) or query,
                "query": query,
            }
            for p in data.get("results", [])
        ]
    except Exception as e:
        logger.warning("Unsplash search failed for %r: %s", query, e)
        return []


async def search_all(queries: list[str], per_query: int = 10) -> list[dict]:
    """Search Pexels + Unsplash with up to 4 queries in parallel. Deduplicate."""
    top_queries = queries[:4]
    tasks = []
    for q in top_queries:
        tasks.append(_search_pexels(q, per_query))
        tasks.append(_search_unsplash(q, per_query))

    nested = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    results: list[dict] = []
    for batch in nested:
        if isinstance(batch, Exception):
            continue
        for img in batch:
            if img["id"] not in seen:
                seen.add(img["id"])
                results.append(img)

    return results
