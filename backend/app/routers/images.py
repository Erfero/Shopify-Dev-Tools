"""
Images router — product image analysis, stock photo search, Shopify upload.
"""
import logging
import uuid
from pathlib import Path
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
    landscape_count: int = 3
    portrait_count: int = 12


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
    landscape_count: int = 3
    portrait_count: int = 12


class IconsRequest(BaseModel):
    product_name: str
    product_description: str = ""
    marketing_angles: str = ""
    n: int = 6


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
async def get_config():
    """Return which external services are configured."""
    return {
        "pexels": bool(settings.pexels_api_key),
        "unsplash": bool(settings.unsplash_access_key),
        "together": True,  # Pollinations.ai — free, no API key required
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
    """Generate images via Pollinations.ai (FLUX, free, no API key required)."""
    if not req.dalle_prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt vide.")

    try:
        raw = await generate_dalle_images(req.dalle_prompt, req.landscape_count, req.portrait_count)
        images = [
            {
                "id": f"flux-{i}",
                "source": "DALL-E",
                "orientation": img["orientation"],
                "url": img["url"],
                "thumb": img["url"],
                "photographer": "FLUX AI",
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


@router.post("/upload-shopify-binary")
async def upload_binary_to_shopify(
    file: UploadFile = File(...),
    store_domain: str = Form(...),
    api_token: str = Form(...),
    filename: str = Form("icon.png"),
    alt_text: str = Form(""),
):
    """Upload a binary image (icon PNG) to Shopify Files via ImgBB or local temp URL."""
    if not store_domain or not api_token:
        raise HTTPException(status_code=400, detail="store_domain et api_token requis.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 10 Mo).")

    public_url: str | None = None

    # Try ImgBB first — gives a stable public URL Shopify can download
    if settings.imgbb_api_key:
        try:
            from app.services.reviews.image_uploader import upload_to_imgbb
            public_url = await upload_to_imgbb(content, filename)
        except Exception:
            pass

    if not public_url:
        # Save locally and use backend_url to expose it
        backend_url = settings.backend_url.rstrip("/")
        if not backend_url or "localhost" in backend_url or "127.0.0.1" in backend_url:
            raise HTTPException(
                status_code=503,
                detail="Configure IMGBB_API_KEY ou BACKEND_URL (URL Render) pour uploader des icônes sur Shopify.",
            )
        temp_name = f"icon_{uuid.uuid4().hex[:12]}_{filename}"
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)
        (uploads_dir / temp_name).write_bytes(content)
        public_url = f"{backend_url}/uploads/{temp_name}"

    try:
        result = await upload_image_to_shopify(public_url, store_domain, api_token, filename, alt_text)
    except Exception as e:
        logger.error("Binary Shopify upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Upload Shopify échoué : {e}")

    return result
