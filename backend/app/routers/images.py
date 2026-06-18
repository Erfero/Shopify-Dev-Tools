"""
Images router — product image analysis, stock photo search, Shopify upload.
"""
import logging

from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.services.images.analyzer import analyze_product_image
from app.services.images.generator import generate_dalle_images
from app.services.images.icon_finder import find_product_icons
from app.services.images.shopify_uploader import upload_image_to_shopify
from app.services.images.stock_searcher import search_oriented

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/images", tags=["images"])


# ── Schema ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    queries: list[str]
    per_query: int = 10
    landscape_count: int = 2
    portrait_count: int = 8


class ShopifyUploadRequest(BaseModel):
    image_url: str
    store_domain: str
    api_token: str
    filename: str = "product-lifestyle.jpg"
    alt_text: str = ""


class BulkUploadRequest(BaseModel):
    images: list[dict]   # [{url, filename, alt_text}]
    store_domain: str
    api_token: str


class GenerateRequest(BaseModel):
    dalle_prompt: str
    landscape_count: int = 2
    portrait_count: int = 8


class IconsRequest(BaseModel):
    product_name: str
    product_description: str = ""
    marketing_angles: str = ""
    n: int = 5


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    """Return which external services are configured."""
    return {
        "pexels": bool(settings.pexels_api_key),
        "unsplash": bool(settings.unsplash_access_key),
        "together": bool(settings.together_api_key),
        "vision_model": settings.vision_model,
    }


@router.post("/analyze")
async def analyze_image(
    image: Optional[UploadFile] = File(None),
    product_name: str = Form(...),
    product_description: str = Form(""),
    marketing_angles: str = Form(""),
):
    """Analyze product image (optional) + text info → specific search queries."""
    content: bytes | None = None
    content_type = "image/jpeg"

    if image is not None and image.filename:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Le fichier doit être une image.")
        content = await image.read()
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image trop volumineuse (max 20 Mo).")
        content_type = image.content_type

    if content is not None and not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="Clé OpenRouter manquante.")

    try:
        analysis = await analyze_product_image(
            content,
            content_type,
            product_name,
            product_description,
            marketing_angles,
        )
        return {"success": True, "analysis": analysis}
    except Exception as e:
        logger.error("Image analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Analyse échouée : {e}")


@router.post("/search")
async def search_images(req: SearchRequest):
    """Search Pexels + Unsplash with provided queries."""
    if not req.queries:
        raise HTTPException(status_code=400, detail="Aucune requête fournie.")

    if not settings.pexels_api_key and not settings.unsplash_access_key:
        raise HTTPException(
            status_code=503,
            detail="Aucune clé API stock photo configurée (PEXELS_API_KEY ou UNSPLASH_ACCESS_KEY).",
        )

    results = await search_oriented(req.queries, req.landscape_count, req.portrait_count)
    return {"success": True, "images": results, "count": len(results)}


@router.post("/generate")
async def generate_images_endpoint(req: GenerateRequest):
    """Generate images with DALL-E 3 via OpenRouter."""
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="Clé OpenRouter manquante.")
    if not req.dalle_prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt vide.")

    try:
        raw = await generate_dalle_images(req.dalle_prompt, req.landscape_count, req.portrait_count)
        images = [
            {
                "id": f"dalle-{i}",
                "source": "DALL-E",
                "orientation": img["orientation"],
                "url": img["url"],
                "thumb": img["url"],
                "photographer": "DALL-E 3",
                "alt": req.dalle_prompt[:120],
                "query": req.dalle_prompt[:60],
            }
            for i, img in enumerate(raw)
        ]
        return {"success": True, "images": images, "count": len(images)}
    except Exception as e:
        logger.error("Image generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Génération échouée : {e}")


@router.post("/icons")
async def find_icons(req: IconsRequest):
    """Find 3-6 Lucide SVG icons matching product benefits."""
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="Clé OpenRouter manquante.")
    if not req.product_name.strip():
        raise HTTPException(status_code=400, detail="Nom du produit requis.")
    try:
        icons = await find_product_icons(
            req.product_name,
            req.product_description,
            req.marketing_angles,
            max(3, min(req.n, 6)),
        )
        return {"success": True, "icons": icons}
    except Exception as e:
        logger.error("Icon finder failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Recherche d'icônes échouée : {e}")


@router.post("/upload-shopify")
async def upload_single(req: ShopifyUploadRequest):
    """Upload one image to Shopify Files."""
    if not req.store_domain or not req.api_token:
        raise HTTPException(status_code=400, detail="store_domain et api_token requis.")

    try:
        result = await upload_image_to_shopify(
            req.image_url,
            req.store_domain,
            req.api_token,
            req.filename,
            req.alt_text,
        )
        return result
    except Exception as e:
        logger.error("Shopify upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Upload Shopify échoué : {e}")


@router.post("/upload-shopify-bulk")
async def upload_bulk(req: BulkUploadRequest):
    """Upload multiple selected images to Shopify Files."""
    if not req.store_domain or not req.api_token:
        raise HTTPException(status_code=400, detail="store_domain et api_token requis.")
    if not req.images:
        raise HTTPException(status_code=400, detail="Aucune image sélectionnée.")

    results = []
    for img in req.images[:20]:  # cap at 20
        try:
            r = await upload_image_to_shopify(
                img.get("url", ""),
                req.store_domain,
                req.api_token,
                img.get("filename", "product-lifestyle.jpg"),
                img.get("alt_text", ""),
            )
            results.append({"input_url": img["url"], **r})
        except Exception as e:
            results.append({"input_url": img.get("url", ""), "success": False, "error": str(e)})

    ok = sum(1 for r in results if r.get("success"))
    return {"success": True, "uploaded": ok, "total": len(results), "results": results}
