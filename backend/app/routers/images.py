"""
Images router — product image analysis, stock photo search, Shopify upload.
"""
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.services.images.analyzer import analyze_product_image
from app.services.images.shopify_uploader import upload_image_to_shopify
from app.services.images.stock_searcher import search_all

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/images", tags=["images"])


# ── Schema ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    queries: list[str]
    per_query: int = 10


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    """Return which external services are configured."""
    return {
        "pexels": bool(settings.pexels_api_key),
        "unsplash": bool(settings.unsplash_access_key),
        "vision_model": settings.vision_model,
    }


@router.post("/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    product_name: str = Form(...),
    product_description: str = Form(""),
    marketing_angles: str = Form(""),
):
    """Analyze product image + text info → specific search queries covering all image types."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier doit être une image.")

    content = await image.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image trop volumineuse (max 20 Mo).")

    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="Clé OpenRouter manquante.")

    try:
        analysis = await analyze_product_image(
            content,
            image.content_type,
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

    results = await search_all(req.queries, per_query=min(req.per_query, 15))
    return {"success": True, "images": results, "count": len(results)}


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
