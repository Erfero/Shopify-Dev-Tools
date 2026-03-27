import asyncio
import json
import logging
import shutil
import time as _time
import uuid
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.auth import verify_token
from app.rate_limiter import upload_limiter, generate_limiter
from app.config import settings

logger = logging.getLogger(__name__)

# Max ZIP size: 150 MB (Shopify themes are typically under 50 MB)
_MAX_ZIP_BYTES = 150 * 1024 * 1024
# Max products per generation request
_MAX_PRODUCTS = 50
from app.database import theme_history_add, theme_history_list, theme_history_get, theme_history_delete, theme_history_clear, save_theme_zip, get_theme_zip, delete_theme_zip, save_theme_output_zip, get_theme_output_zip, delete_theme_output_zip, clear_all_theme_output_zips, list_theme_output_zip_ids, analytics_record, analytics_increment_regen, analytics_get_summary, log_activity
from app.models.theme_schemas import UploadResponse, GenerationStep
from app.services.theme.theme_parser import extract_theme, cleanup_session, ThemeStructure, EDITABLE_JSON_FILES
from app.services.theme.text_mapper import extract_text_slots
from app.services.theme.ai_generator import generate_all_texts, generate_single_section
from app.services.theme.mock_generator import generate_mock_texts
from app.services.theme.theme_modifier import apply_generated_texts
from app.services.theme.theme_translator import translate_remaining_texts
from app.services.theme.theme_exporter import export_theme
from app.utils.json_handler import read_theme_json, detect_json_format

router = APIRouter(prefix="/api/theme", tags=["theme"], dependencies=[Depends(verify_token)])

# ── In-memory session store ───────────────────────────────────────────────────

_sessions: dict[str, dict] = {}

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# ── Session persistence helpers ───────────────────────────────────────────────

def _meta_path(session_id: str) -> Path:
    return settings.temp_path / session_id / "_session_meta.json"


def _save_session_meta(session_id: str, session: dict) -> None:
    """Sauvegarde les métadonnées de session sur disque (survit aux redémarrages)."""
    path = _meta_path(session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    structure: ThemeStructure | None = session.get("structure")
    meta = {
        "session_id": session_id,
        "extract_dir": str(structure.extract_dir) if structure else "",
        "theme_name": structure.theme_name if structure else "",
        "templates_found": structure.templates_found if structure else [],
        "language": session.get("language", "fr"),
        "target_gender": session.get("target_gender", "femme"),
        "store_name": session.get("store_name", ""),
        "store_email": session.get("store_email", ""),
        "product_names": session.get("product_names", []),
        "product_description": session.get("product_description"),
        "product_price": session.get("product_price"),
        "store_address": session.get("store_address"),
        "siret": session.get("siret"),
        "delivery_delay": session.get("delivery_delay", "3-5 jours ouvrés"),
        "return_policy_days": session.get("return_policy_days", "30"),
        "marketing_angles": session.get("marketing_angles"),
        "generated_texts": session.get("generated_texts"),
        "zip_path": session.get("zip_path"),
        "created_at": session.get("created_at", datetime.now().isoformat()),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)


async def _restore_session(session_id: str) -> dict | None:
    """Tente de restaurer une session depuis le disque, puis depuis la DB si besoin."""
    path = _meta_path(session_id)
    meta: dict = {}

    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    extract_dir = Path(meta.get("extract_dir", "")) if meta else Path("")

    # Disk files missing → rebuild from DB ZIP cache (survives Render restarts)
    # Note: Path("").exists() returns True (CWD), so we must also check the path is non-empty
    if not meta.get("extract_dir") or not extract_dir.exists():
        result = await get_theme_zip(session_id)
        if result is None:
            return None
        filename, zip_bytes = result
        tmp_zip = settings.temp_path / f"_restore_{session_id}.zip"
        settings.temp_path.mkdir(parents=True, exist_ok=True)
        try:
            tmp_zip.write_bytes(zip_bytes)
            structure = extract_theme(tmp_zip)
        except Exception:
            return None
        finally:
            tmp_zip.unlink(missing_ok=True)
        session = {
            "structure": structure,
            "text_slots": extract_text_slots(structure.parsed_files),
            "generated_texts": meta.get("generated_texts"),
            "modified_files": None,
            "language": meta.get("language", "fr"),
            "target_gender": meta.get("target_gender", "femme"),
            "store_name": meta.get("store_name", ""),
            "store_email": meta.get("store_email", ""),
            "product_names": meta.get("product_names", []),
            "product_description": meta.get("product_description"),
            "product_price": meta.get("product_price"),
            "store_address": meta.get("store_address"),
            "siret": meta.get("siret"),
            "delivery_delay": meta.get("delivery_delay", "3-5 jours ouvrés"),
            "return_policy_days": meta.get("return_policy_days", "30"),
            "marketing_angles": meta.get("marketing_angles"),
            "zip_path": meta.get("zip_path"),
            "created_at": meta.get("created_at", datetime.now().isoformat()),
        }
        _save_session_meta(session_id, session)
        return session

    structure = ThemeStructure(session_id=session_id, extract_dir=extract_dir)
    structure.theme_name = meta.get("theme_name", "")
    structure.templates_found = meta.get("templates_found", [])
    for rel_path in EDITABLE_JSON_FILES:
        file_path = extract_dir / rel_path
        if file_path.exists():
            data, comment = read_theme_json(file_path)
            is_compact = detect_json_format(file_path)
            structure.parsed_files[rel_path] = (data, comment, is_compact)

    return {
        "structure": structure,
        "text_slots": [],
        "generated_texts": meta.get("generated_texts"),
        "modified_files": None,
        "language": meta.get("language", "fr"),
        "target_gender": meta.get("target_gender", "femme"),
        "store_name": meta.get("store_name", ""),
        "store_email": meta.get("store_email", ""),
        "product_names": meta.get("product_names", []),
        "product_description": meta.get("product_description"),
        "product_price": meta.get("product_price"),
        "store_address": meta.get("store_address"),
        "siret": meta.get("siret"),
        "delivery_delay": meta.get("delivery_delay", "3-5 jours ouvrés"),
        "return_policy_days": meta.get("return_policy_days", "30"),
        "marketing_angles": meta.get("marketing_angles"),
        "zip_path": meta.get("zip_path"),
        "created_at": meta.get("created_at"),
    }


async def _get_session(session_id: str) -> dict | None:
    """Récupère une session avec vérification TTL et fallback disque/DB."""
    session = _sessions.get(session_id)

    if session is None:
        session = await _restore_session(session_id)
        if session:
            _sessions[session_id] = session

    if session is None:
        return None

    created_at_str = session.get("created_at", "")
    if created_at_str:
        try:
            created_at = datetime.fromisoformat(created_at_str)
            if (datetime.now() - created_at).total_seconds() > settings.session_ttl_seconds:
                _sessions.pop(session_id, None)
                return None
        except ValueError:
            pass

    return session


def evict_expired_sessions() -> int:
    """Remove expired sessions from the in-memory store. Returns number evicted."""
    now = datetime.now()
    expired = [
        sid for sid, s in list(_sessions.items())
        if (ts := s.get("created_at", ""))
        and (now - datetime.fromisoformat(ts)).total_seconds() > settings.session_ttl_seconds
    ]
    for sid in expired:
        _sessions.pop(sid, None)
    return len(expired)


@router.post("/upload", response_model=UploadResponse, dependencies=[Depends(upload_limiter)])
async def upload_theme(theme_file: UploadFile = File(...)):
    """Upload a Shopify theme ZIP file and parse its structure."""
    if not theme_file.filename or not theme_file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Le fichier doit être un ZIP")

    content = await theme_file.read()

    if len(content) > _MAX_ZIP_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Le fichier ZIP est trop volumineux (max {_MAX_ZIP_BYTES // 1024 // 1024} Mo).",
        )

    temp_zip = settings.temp_path / f"upload_{theme_file.filename}"
    settings.temp_path.mkdir(parents=True, exist_ok=True)
    with open(temp_zip, "wb") as f:
        f.write(content)

    try:
        # Run blocking ZIP extraction in a thread to avoid blocking the async event loop
        loop = asyncio.get_event_loop()
        structure = await loop.run_in_executor(None, extract_theme, temp_zip)
    except Exception as e:
        temp_zip.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Erreur lors de l'extraction du theme: {str(e)}")
    finally:
        temp_zip.unlink(missing_ok=True)

    text_slots = extract_text_slots(structure.parsed_files)

    session = {
        "structure": structure,
        "text_slots": text_slots,
        "generated_texts": None,
        "modified_files": None,
        "language": "fr",
        "created_at": datetime.now().isoformat(),
    }
    _sessions[structure.session_id] = session
    _save_session_meta(structure.session_id, session)

    # Save ZIP to DB so the session can be rebuilt after a server restart
    try:
        await save_theme_zip(structure.session_id, theme_file.filename, content)
    except Exception as e:
        logger.warning("Could not save ZIP to DB for session %s: %s", structure.session_id, e)

    return UploadResponse(
        session_id=structure.session_id,
        theme_name=structure.theme_name,
        sections_count=structure.sections_count,
        templates_found=structure.templates_found,
    )


@router.post("/generate", dependencies=[Depends(generate_limiter)])
async def generate_theme(
    session_id: str = Form(...),
    store_name: str = Form(...),
    store_email: str = Form(...),
    product_names: str = Form(...),
    product_description: Optional[str] = Form(None),
    language: str = Form("fr"),
    target_gender: str = Form("femme"),
    product_price: Optional[str] = Form(None),
    store_address: Optional[str] = Form(None),
    siret: Optional[str] = Form(None),
    delivery_delay: str = Form("3-5 jours ouvrés"),
    return_policy_days: str = Form("30"),
    product_images: list[UploadFile] = File(default=[]),
    marketing_angles: Optional[str] = Form(None),
):
    """Generate all texts via AI. Returns SSE stream with generation progress."""
    session = await _get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvee. Veuillez re-uploader le theme.")

    try:
        parsed_product_names = json.loads(product_names)
        if not isinstance(parsed_product_names, list):
            parsed_product_names = [product_names]
    except json.JSONDecodeError:
        parsed_product_names = [product_names]

    if len(parsed_product_names) > _MAX_PRODUCTS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {_MAX_PRODUCTS} produits par requête.",
        )

    session["language"] = language
    session["target_gender"] = target_gender
    session["store_name"] = store_name
    session["store_email"] = store_email
    session["product_names"] = parsed_product_names
    session["product_description"] = product_description
    session["product_price"] = product_price
    session["store_address"] = store_address
    session["siret"] = siret
    session["delivery_delay"] = delivery_delay
    session["return_policy_days"] = return_policy_days
    session["marketing_angles"] = marketing_angles

    image_paths: list[Path] = []
    images_dir = settings.temp_path / session_id / "_product_images"
    if product_images:
        images_dir.mkdir(parents=True, exist_ok=True)
        for img in product_images:
            if img.content_type and img.content_type in ALLOWED_IMAGE_TYPES and img.filename:
                # Use a random name to prevent path traversal via malicious filenames
                ext = Path(img.filename).suffix.lower() or ".jpg"
                safe_name = f"{uuid.uuid4().hex}{ext}"
                img_path = images_dir / safe_name
                with open(img_path, "wb") as f:
                    f.write(await img.read())
                image_paths.append(img_path)

    async def event_stream():
        all_results = {}
        has_any_success = False
        _start_time = _time.monotonic()

        generator_fn = generate_mock_texts if settings.use_mock else generate_all_texts

        async for step_id, status, data in generator_fn(
            store_name=store_name,
            store_email=store_email,
            product_names=parsed_product_names,
            product_description=product_description,
            language=language,
            image_paths=image_paths if image_paths else None,
            target_gender=target_gender,
            product_price=product_price,
            store_address=store_address,
            siret=siret,
            delivery_delay=delivery_delay,
            return_policy_days=return_policy_days,
            marketing_angles=marketing_angles,
        ):
            step_data = None
            if status == "done" and step_id != "complete":
                step_data = data
            elif status == "error" and data:
                step_data = data

            step = GenerationStep(
                step=step_id,
                status=status,
                message=_step_message(step_id, status, data),
                data=step_data,
            )

            if status == "done" and data and step_id != "complete":
                all_results[step_id] = data
                has_any_success = True
            elif step_id == "complete" and data:
                all_results = data

            yield f"data: {step.model_dump_json()}\n\n"

        _duration = _time.monotonic() - _start_time

        if not has_any_success:
            error_step = GenerationStep(
                step="preview",
                status="error",
                message="Aucun texte n'a pu etre genere. Verifiez votre cle API et le modele configure.",
            )
            yield f"data: {error_step.model_dump_json()}\n\n"
            try:
                await analytics_record(
                    session_id=session_id,
                    store_name=store_name,
                    language=language,
                    product_count=len(parsed_product_names),
                    has_images=bool(image_paths),
                    duration_seconds=_duration,
                    success=False,
                )
            except Exception:
                pass
            return

        session["generated_texts"] = all_results
        _save_session_meta(session_id, session)

        try:
            await analytics_record(
                session_id=session_id,
                store_name=store_name,
                language=language,
                product_count=len(parsed_product_names),
                has_images=bool(image_paths),
                duration_seconds=_duration,
                success=True,
            )
        except Exception:
            pass

        preview_step = GenerationStep(
            step="preview",
            status="done",
            message="Textes generes — previsualisation et edition disponibles.",
            data=all_results,
        )
        yield f"data: {preview_step.model_dump_json()}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/apply")
async def apply_theme(
    session_id: str = Form(...),
    generated_data: str = Form(...),
    current_user: dict = Depends(verify_token),
):
    """Apply generated texts to the theme and export a ZIP."""
    session = await _get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvee. Veuillez re-uploader le theme.")

    try:
        all_results = json.loads(generated_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Donnees invalides (JSON malformed).")

    structure = session["structure"]

    try:
        language = session.get("language", "fr")
        target_gender = session.get("target_gender", "femme")
        store_name = session.get("store_name", "")
        modified_files = apply_generated_texts(structure, all_results, language=language, target_gender=target_gender, store_name=store_name)

        await translate_remaining_texts(
            structure.extract_dir, structure.parsed_files, language
        )

        session["generated_texts"] = all_results
        session["modified_files"] = modified_files

        zip_path = export_theme(
            session_id=structure.session_id,
            theme_root=structure.extract_dir,
            modified_files=modified_files,
            store_name=store_name,
        )
        session["zip_path"] = str(zip_path)

        history_id = str(uuid.uuid4())

        # Persist output ZIP in DB so it survives server restarts (5-day retention)
        try:
            zip_bytes = zip_path.read_bytes()
            await save_theme_output_zip(history_id, zip_path.name, zip_bytes)
        except Exception as e:
            logger.warning("Could not save output ZIP to DB for %s: %s", history_id, e)

        user_email = current_user.get("email", "inconnu")
        try:
            await theme_history_add({
                "id": history_id,
                "filename": zip_path.name,
                "store_name": store_name,
                "created_at": datetime.now().isoformat(),
                "zip_path": str(zip_path),
                "user_email": user_email,
            })
        except Exception:
            pass  # Non-fatal: history entry is optional

        import json as _json
        await log_activity(user_email, "theme_generate", _json.dumps({
            "store_name": store_name,
            "filename": zip_path.name,
            "products": session.get("product_names", []),
        }))

        return {"download_url": f"/api/theme/download/{structure.session_id}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'application: {str(e)}")


@router.get("/download/{session_id}")
async def download_theme(session_id: str):
    """Download the modified theme ZIP."""
    session = await _get_session(session_id)
    if not session or not session.get("zip_path"):
        raise HTTPException(status_code=404, detail="Theme non trouve. Veuillez regenerer.")

    zip_path = Path(session["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Fichier ZIP non trouve.")

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=zip_path.name,
    )


@router.get("/preview/{session_id}")
async def preview_texts(session_id: str):
    """Get a preview of the current text slots in the uploaded theme."""
    session = await _get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvee.")

    text_slots = session.get("text_slots", [])
    preview = {}
    for slot in text_slots:
        section_key = f"{slot.file_path} > {slot.section_type}"
        if section_key not in preview:
            preview[section_key] = {}
        preview[section_key][slot.field_key] = slot.current_value[:200]

    return {"texts": preview}


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session and its temporary files."""
    if session_id in _sessions:
        del _sessions[session_id]
    cleanup_session(session_id)
    try:
        await delete_theme_zip(session_id)
    except Exception:
        pass
    return {"status": "deleted"}


# ── History endpoints ─────────────────────────────────────────────────────────

@router.get("/history")
async def get_history(current_user: dict = Depends(verify_token)):
    """Return themes for current user (admin sees all)."""
    is_admin = current_user.get("is_admin", False)
    user_email = current_user.get("email", "inconnu")
    entries = await theme_history_list(user_email=None if is_admin else user_email)
    cached_ids = await list_theme_output_zip_ids()
    return [
        {
            "id": e["id"],
            "filename": e["filename"],
            "store_name": e["store_name"],
            "created_at": e["created_at"],
            "available": Path(e["zip_path"]).exists() or e["id"] in cached_ids,
            **({"user_email": e.get("user_email", "inconnu")} if is_admin else {}),
        }
        for e in entries
    ]


@router.get("/history/{history_id}/download")
async def download_history_item(history_id: str, current_user: dict = Depends(verify_token)):
    """Download a theme from history by its ID."""
    entry = await theme_history_get(history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Fichier non trouvé dans l'historique.")
    # Non-admin can only download their own themes
    if not current_user.get("is_admin") and entry.get("user_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Accès refusé.")
    zip_path = Path(entry["zip_path"])
    if not zip_path.exists():
        result = await get_theme_output_zip(history_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Fichier ZIP introuvable sur le serveur.")
        _, zip_bytes = result
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        zip_path.write_bytes(zip_bytes)
    await log_activity(current_user.get("email", "inconnu"), "theme_download", entry["filename"])
    return FileResponse(path=zip_path, media_type="application/zip", filename=entry["filename"])


@router.delete("/history/{history_id}")
async def delete_history_item(history_id: str, current_user: dict = Depends(verify_token)):
    """Delete a single history entry — owner or admin only."""
    entry = await theme_history_get(history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée non trouvée.")
    if not current_user.get("is_admin") and entry.get("user_email") != current_user.get("email"):
        raise HTTPException(status_code=403, detail="Accès refusé.")
    zip_path = Path(entry["zip_path"])
    zip_path.unlink(missing_ok=True)
    await theme_history_delete(history_id)
    try:
        await delete_theme_output_zip(history_id)
    except Exception:
        pass
    return {"status": "deleted"}


@router.delete("/history")
async def clear_history(current_user: dict = Depends(verify_token)):
    """Delete history — user clears only their own, admin clears all."""
    is_admin = current_user.get("is_admin", False)
    user_email = current_user.get("email", "inconnu")
    entries = await theme_history_list(user_email=None if is_admin else user_email)
    for entry in entries:
        Path(entry["zip_path"]).unlink(missing_ok=True)
        await theme_history_delete(entry["id"])
        try:
            await delete_theme_output_zip(entry["id"])
        except Exception:
            pass
    if is_admin:
        try:
            await clear_all_theme_output_zips()
        except Exception:
            pass
    return {"status": "cleared"}


@router.post("/regenerate")
async def regenerate_section(
    session_id: str = Form(...),
    section: str = Form(...),
):
    """Regenerate a single section using stored session config. Returns SSE stream."""
    session = await _get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvee. Veuillez re-uploader le theme.")

    meta_path = _meta_path(session_id)
    meta: dict = {}
    if meta_path.exists():
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    store_name = meta.get("store_name") or session.get("store_name", "")
    store_email = meta.get("store_email") or session.get("store_email", "")
    product_names = meta.get("product_names") or session.get("product_names", [])
    product_description = meta.get("product_description") or session.get("product_description")
    language = meta.get("language") or session.get("language", "fr")
    target_gender = meta.get("target_gender") or session.get("target_gender", "femme")
    product_price = meta.get("product_price") or session.get("product_price")
    store_address = meta.get("store_address") or session.get("store_address")
    siret = meta.get("siret") or session.get("siret")
    delivery_delay = meta.get("delivery_delay") or session.get("delivery_delay", "3-5 jours ouvrés")
    return_policy_days = meta.get("return_policy_days") or session.get("return_policy_days", "30")
    marketing_angles = meta.get("marketing_angles") or session.get("marketing_angles")

    # Re-use existing product images if still on disk
    images_dir = settings.temp_path / session_id / "_product_images"
    image_paths: list[Path] = []
    if images_dir.exists():
        image_paths = [p for p in images_dir.iterdir() if p.is_file()]

    async def regen_stream():
        result_data: dict | None = None

        async for step_id, status, data in generate_single_section(
            section=section,
            store_name=store_name,
            store_email=store_email,
            product_names=product_names,
            product_description=product_description,
            language=language,
            image_paths=image_paths if image_paths else None,
            target_gender=target_gender,
            product_price=product_price,
            store_address=store_address,
            siret=siret,
            delivery_delay=delivery_delay,
            return_policy_days=return_policy_days,
            marketing_angles=marketing_angles,
        ):
            step_obj = GenerationStep(
                step=step_id,
                status=status,
                message=_step_message(step_id, status, data),
                data=data if status in ("done", "error") else None,
            )
            if status == "done":
                result_data = data
            yield f"data: {step_obj.model_dump_json()}\n\n"

        if result_data is not None:
            # Merge result into session's generated_texts
            generated = session.get("generated_texts") or {}
            generated[section] = result_data
            session["generated_texts"] = generated
            _save_session_meta(session_id, session)

            # Increment regen counter in analytics
            try:
                await analytics_increment_regen(session_id)
            except Exception:
                pass

    return StreamingResponse(
        regen_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/analytics")
async def get_analytics(current_user: dict = Depends(verify_token)):
    """Return analytics summary — admin only."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur.")
    try:
        summary = await analytics_get_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur analytics: {str(e)}")


def _step_message(step_id: str, status: str, data: dict | None = None) -> str:
    """Get a human-readable message for a generation step."""
    labels = {
        "colors": "Palette de couleurs",
        "homepage": "Textes page d'accueil",
        "product_page": "Textes page produit",
        "faq": "Questions frequentes",
        "legal_pages": "Pages legales",
        "story_page": "Page Notre Histoire",
        "global_texts": "Textes globaux",
        "preview": "Previsualisation",
        "complete": "Generation terminee",
    }
    label = labels.get(step_id, step_id)
    if status == "generating":
        return f"Generation en cours : {label}..."
    elif status == "done":
        return f"{label} termine"
    elif status == "error":
        error_detail = ""
        if data and isinstance(data, dict) and "error" in data:
            error_detail = f" - {data['error'][:150]}"
        return f"Erreur : {label}{error_detail}"
    return label
