"""
Stock photo search — Pexels + Unsplash APIs.
Both are free with registration. Results are deduplicated across sources.
"""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def _search_pexels(query: str, per_page: int = 12, orientation: str = "landscape") -> list[dict]:
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
                    "orientation": orientation,
                    "size": "large",
                },
            )
            r.raise_for_status()
            data = r.json()
        return [
            {
                "id": f"pexels_{p['id']}",
                "source": "Pexels",
                "orientation": orientation,
                "url": p["src"]["large2x"],
                "thumb": p["src"]["medium"],
                "photographer": p.get("photographer", ""),
                "alt": p.get("alt", query) or query,
                "query": query,
            }
            for p in data.get("photos", [])
        ]
    except Exception as e:
        logger.warning("Pexels search failed for %r (%s): %s", query, orientation, e)
        return []


async def _search_unsplash(query: str, per_page: int = 12, orientation: str = "landscape") -> list[dict]:
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
                    "orientation": orientation,
                    "content_filter": "high",
                },
            )
            r.raise_for_status()
            data = r.json()
        return [
            {
                "id": f"unsplash_{p['id']}",
                "source": "Unsplash",
                "orientation": orientation,
                "url": p["urls"]["full"],
                "thumb": p["urls"]["small"],
                "photographer": p.get("user", {}).get("name", ""),
                "alt": p.get("alt_description", query) or query,
                "query": query,
            }
            for p in data.get("results", [])
        ]
    except Exception as e:
        logger.warning("Unsplash search failed for %r (%s): %s", query, orientation, e)
        return []


async def search_oriented(
    queries: list[str],
    landscape_count: int = 2,
    portrait_count: int = 8,
) -> list[dict]:
    """
    Search Pexels + Unsplash for both orientations.
    Returns up to landscape_count landscape + portrait_count portrait images.
    """
    l_queries = queries[:2] if queries else []
    p_queries = queries[:4] if queries else []

    l_per = max(3, (landscape_count // max(len(l_queries), 1)) + 2)
    p_per = max(4, (portrait_count // max(len(p_queries), 1)) + 2)

    tasks = []
    for q in l_queries:
        tasks.append(_search_pexels(q, l_per, "landscape"))
        tasks.append(_search_unsplash(q, l_per, "landscape"))
    for q in p_queries:
        tasks.append(_search_pexels(q, p_per, "portrait"))
        tasks.append(_search_unsplash(q, p_per, "portrait"))

    all_batches = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set[str] = set()
    landscapes: list[dict] = []
    portraits: list[dict] = []

    for batch in all_batches:
        if isinstance(batch, Exception):
            continue
        for img in batch:
            if img["id"] in seen:
                continue
            seen.add(img["id"])
            if img["orientation"] == "landscape":
                landscapes.append(img)
            else:
                portraits.append(img)

    return landscapes[:landscape_count] + portraits[:portrait_count]
