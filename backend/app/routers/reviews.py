import csv
import io
import json
from typing import List, AsyncGenerator, Optional

from fastapi import APIRouter, Form, File, UploadFile, Response, Request
from fastapi.responses import StreamingResponse

from app.services.reviews.ai_generator import generate_review_batch, analyze_product_images
from app.services.reviews.csv_generator import (
    generate_loox_full_csv, generate_loox_import_csv,
    generate_loox_full_csv_multi, generate_loox_import_csv_multi,
)
from app.services.reviews.image_uploader import process_image
from app import database

router = APIRouter()


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def generation_stream(
    product_name: str,
    brand_name: str,
    product_description: str,
    product_handle: str,
    target_gender: str,
    language: str,
    review_count: int,
    session_id: str,
    image_urls: List[str],
    product_images_data: List[bytes],
    product_images_mime: List[str],
    female_image_urls: Optional[List[str]] = None,
    male_image_urls: Optional[List[str]] = None,
) -> AsyncGenerator[str, None]:
    all_reviews = []
    existing_authors: List[str] = []
    visual_analysis: Optional[str] = None

    batch_size = 10
    num_batches = (review_count + batch_size - 1) // batch_size

    yield sse_event({"type": "start", "message": "Démarrage de la génération...", "progress": 0})

    if product_images_data:
        yield sse_event({
            "type": "progress",
            "message": f"Analyse de vos {len(product_images_data)} photo(s) produit avec l'IA vision...",
            "progress": 3,
            "count": 0,
        })
        try:
            visual_analysis = await analyze_product_images(product_images_data, product_images_mime)
            yield sse_event({
                "type": "progress",
                "message": "✓ Photos analysées — l'IA connaît votre produit précisément",
                "progress": 8,
                "count": 0,
            })
        except Exception as e:
            yield sse_event({
                "type": "progress",
                "message": f"⚠ Analyse photos ignorée, génération sans vision ({str(e)[:50]})",
                "progress": 5,
                "count": 0,
            })

    base_progress = 10 if product_images_data else 0

    for batch_num in range(1, num_batches + 1):
        current_batch_size = min(batch_size, review_count - len(all_reviews))
        start_idx = (batch_num - 1) * batch_size + 1
        end_idx = min(batch_num * batch_size, review_count)
        batch_progress = base_progress + int((batch_num - 1) / num_batches * (85 - base_progress))

        yield sse_event({
            "type": "progress",
            "message": f"Génération des avis {start_idx}–{end_idx}...",
            "progress": batch_progress,
            "count": len(all_reviews),
        })

        try:
            batch = await generate_review_batch(
                product_name=product_name,
                brand_name=brand_name,
                product_description=product_description,
                target_gender=target_gender,
                language=language,
                batch_size=current_batch_size,
                batch_number=batch_num,
                existing_authors=existing_authors,
                visual_analysis=visual_analysis,
            )
            all_reviews.extend(batch)
            existing_authors.extend([r.get("author", "") for r in batch])

            yield sse_event({
                "type": "progress",
                "message": f"✓ {len(all_reviews)} avis générés",
                "progress": base_progress + int(batch_num / num_batches * (85 - base_progress)),
                "count": len(all_reviews),
            })

        except Exception as e:
            yield sse_event({
                "type": "error",
                "message": f"Erreur lot {batch_num}: {str(e)}",
                "progress": batch_progress,
                "count": len(all_reviews),
            })
            if len(all_reviews) == 0:
                return

    yield sse_event({"type": "progress", "message": "Génération des fichiers CSV...", "progress": 90, "count": len(all_reviews)})

    try:
        full_csv = generate_loox_full_csv(all_reviews, product_handle, image_urls, female_image_urls, male_image_urls)
        import_csv = generate_loox_import_csv(all_reviews, product_handle, image_urls, female_image_urls, male_image_urls)

        await database.save_session(session_id, full_csv, import_csv, len(all_reviews))

        yield sse_event({
            "type": "complete",
            "message": f"✓ {len(all_reviews)} avis générés avec succès !",
            "progress": 100,
            "session_id": session_id,
            "count": len(all_reviews),
        })

    except Exception as e:
        yield sse_event({"type": "error", "message": f"Erreur CSV: {str(e)}", "progress": 90, "count": len(all_reviews)})


async def multi_generation_stream(
    products: List[dict],
    session_id: str,
    product_images: dict,
) -> AsyncGenerator[str, None]:
    product_results = []
    total_reviews = sum(int(p.get("review_count", 50)) for p in products)
    generated_total = 0

    yield sse_event({
        "type": "start",
        "message": f"Démarrage — {len(products)} produit(s) à traiter...",
        "progress": 0,
    })

    for prod_idx, product in enumerate(products):
        product_name = product.get("product_name", "")
        brand_name = product.get("brand_name", "")
        product_description = product.get("product_description", "")
        product_handle = product.get("product_handle", "")
        target_gender = product.get("target_gender", "femmes")
        language = product.get("language", "Français")
        review_count = int(product.get("review_count", 50))
        image_urls = product.get("image_urls", [])

        all_reviews: List[dict] = []
        existing_authors: List[str] = []
        visual_analysis: Optional[str] = None
        batch_size = 10
        num_batches = (review_count + batch_size - 1) // batch_size

        images_for_product = product_images.get(prod_idx, [])
        if images_for_product:
            yield sse_event({
                "type": "progress",
                "message": f"Produit {prod_idx + 1}/{len(products)} «{product_name}» — analyse de {len(images_for_product)} photo(s)...",
                "progress": int(generated_total / max(total_reviews, 1) * 90),
                "count": generated_total,
            })
            try:
                imgs_data = [img["data"] for img in images_for_product]
                imgs_mime = [img["mime"] for img in images_for_product]
                visual_analysis = await analyze_product_images(imgs_data, imgs_mime)
                yield sse_event({
                    "type": "progress",
                    "message": f"Produit {prod_idx + 1}/{len(products)} «{product_name}» — photos analysées ✓",
                    "progress": int(generated_total / max(total_reviews, 1) * 90),
                    "count": generated_total,
                })
            except Exception as e:
                yield sse_event({
                    "type": "progress",
                    "message": f"Produit {prod_idx + 1} — analyse photos ignorée ({str(e)[:40]})",
                    "progress": int(generated_total / max(total_reviews, 1) * 90),
                    "count": generated_total,
                })

        for batch_num in range(1, num_batches + 1):
            current_batch_size = min(batch_size, review_count - len(all_reviews))
            overall_progress = int(generated_total / max(total_reviews, 1) * 90)

            yield sse_event({
                "type": "progress",
                "message": f"Produit {prod_idx + 1}/{len(products)} «{product_name}» — lot {batch_num}/{num_batches}",
                "progress": overall_progress,
                "count": generated_total,
            })

            try:
                batch = await generate_review_batch(
                    product_name=product_name,
                    brand_name=brand_name,
                    product_description=product_description,
                    target_gender=target_gender,
                    language=language,
                    batch_size=current_batch_size,
                    batch_number=batch_num,
                    existing_authors=existing_authors,
                    visual_analysis=visual_analysis,
                )
                all_reviews.extend(batch)
                existing_authors.extend([r.get("author", "") for r in batch])
                generated_total += len(batch)

                yield sse_event({
                    "type": "progress",
                    "message": f"Produit {prod_idx + 1}/{len(products)} «{product_name}» — {len(all_reviews)}/{review_count} avis",
                    "progress": int(generated_total / max(total_reviews, 1) * 90),
                    "count": generated_total,
                })
            except Exception as e:
                yield sse_event({
                    "type": "error",
                    "message": f"Erreur produit {prod_idx + 1}: {str(e)}",
                    "progress": int(generated_total / max(total_reviews, 1) * 90),
                    "count": generated_total,
                })
                if len(all_reviews) == 0 and prod_idx == 0:
                    return
                break

        product_results.append({
            "reviews": all_reviews,
            "product_handle": product_handle,
            "image_urls": image_urls,
        })

    yield sse_event({"type": "progress", "message": "Génération du fichier CSV combiné...", "progress": 92, "count": generated_total})

    try:
        full_csv = generate_loox_full_csv_multi(product_results)
        import_csv = generate_loox_import_csv_multi(product_results)

        await database.save_session(session_id, full_csv, import_csv, generated_total)

        yield sse_event({
            "type": "complete",
            "message": f"✓ {generated_total} avis générés pour {len(products)} produit(s) !",
            "progress": 100,
            "session_id": session_id,
            "count": generated_total,
        })
    except Exception as e:
        yield sse_event({"type": "error", "message": f"Erreur CSV: {str(e)}", "progress": 95, "count": generated_total})


@router.post("/reviews/generate-multi")
async def generate_reviews_multi(request: Request):
    form = await request.form()
    session_id = str(form.get("session_id", ""))
    products = json.loads(str(form.get("products_json", "[]")))

    product_images: dict = {}
    for key, value in form.multi_items():
        if key.startswith("product_images_"):
            idx = int(key.rsplit("_", 1)[-1])
            if isinstance(value, UploadFile) and value.filename:
                data = await value.read()
                if data:
                    product_images.setdefault(idx, []).append(
                        {"data": data, "mime": value.content_type or "image/jpeg"}
                    )

    return StreamingResponse(
        multi_generation_stream(products=products, session_id=session_id, product_images=product_images),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.post("/reviews/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
    urls = []
    for file in files:
        data = await file.read()
        url = await process_image(data, file.filename or "image.jpg")
        urls.append(url)
    return {"urls": urls}


@router.post("/reviews/generate")
async def generate_reviews(
    product_name: str = Form(...),
    brand_name: str = Form(...),
    product_description: str = Form(...),
    product_handle: str = Form(...),
    target_gender: str = Form(...),
    language: str = Form(...),
    review_count: int = Form(100),
    session_id: str = Form(...),
    image_urls: str = Form("[]"),
    female_image_urls: str = Form("[]"),
    male_image_urls: str = Form("[]"),
    product_images: List[UploadFile] = File(default=[]),
):
    urls: List[str] = [u for u in json.loads(image_urls) if u and u.strip()]
    female_urls: Optional[List[str]] = [u for u in json.loads(female_image_urls) if u and u.strip()] or None
    male_urls: Optional[List[str]] = [u for u in json.loads(male_image_urls) if u and u.strip()] or None

    images_data: List[bytes] = []
    images_mime: List[str] = []
    for img in product_images:
        if img.filename:
            data = await img.read()
            images_data.append(data)
            images_mime.append(img.content_type or "image/jpeg")

    return StreamingResponse(
        generation_stream(
            product_name=product_name,
            brand_name=brand_name,
            product_description=product_description,
            product_handle=product_handle,
            target_gender=target_gender,
            language=language,
            review_count=review_count,
            session_id=session_id,
            image_urls=urls,
            product_images_data=images_data,
            product_images_mime=images_mime,
            female_image_urls=female_urls,
            male_image_urls=male_urls,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/reviews/download/{session_id}")
async def download_csv(session_id: str, format: str = "full"):
    data = await database.get_session(session_id)
    if data is None:
        return Response(status_code=404, content="Session introuvable.")
    count = data.get("review_count", 0)
    if format == "import":
        csv_content, filename = data["import_csv"], f"loox_import_{count}_avis_{session_id[:8]}.csv"
    else:
        csv_content, filename = data["full_csv"], f"loox_complet_{count}_avis_{session_id[:8]}.csv"
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reviews/preview/{session_id}")
async def preview_reviews(session_id: str):
    data = await database.get_session(session_id)
    if data is None:
        return Response(status_code=404, content="Session introuvable.")
    reviews = []
    try:
        reader = csv.DictReader(io.StringIO(data["full_csv"]))
        for i, row in enumerate(reader):
            if i >= 3:
                break
            reviews.append({
                "author": row.get("nickname", ""),
                "review": row.get("review", ""),
                "reply": row.get("reply", ""),
            })
    except Exception:
        pass
    return {"reviews": reviews, "count": data["review_count"]}


@router.delete("/reviews/session/{session_id}")
async def delete_session(session_id: str):
    await database.delete_review_history(session_id)
    return {"status": "deleted"}


# --- History endpoints ---

@router.get("/reviews/history")
async def get_history():
    return {"entries": await database.get_all_history()}


@router.post("/reviews/history/{session_id}/mark-downloaded")
async def mark_downloaded_route(session_id: str):
    await database.mark_downloaded(session_id)
    return {"ok": True}


@router.delete("/reviews/history/{session_id}")
async def delete_history_route(session_id: str):
    await database.delete_review_history(session_id)
    return {"ok": True}


@router.post("/reviews/history/add")
async def add_history_entry(data: dict):
    await database.add_history_entry(
        data["sessionId"],
        data["productName"],
        data["brandName"],
        data["reviewCount"],
    )
    return {"ok": True}
