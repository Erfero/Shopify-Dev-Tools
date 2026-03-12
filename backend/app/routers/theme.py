import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from app.config import settings
from app.database import theme_history_add, theme_history_list, theme_history_get, theme_history_delete, theme_history_clear, save_theme_zip, get_theme_zip, delete_theme_zip
from app.models.theme_schemas import UploadResponse, GenerationStep
from app.services.theme.theme_parser import extract_theme, cleanup_session, ThemeStructure, EDITABLE_JSON_FILES
from app.services.theme.text_mapper import extract_text_slots
from app.services.theme.ai_generator import generate_all_texts
from app.services.theme.mock_generator import generate_mock_texts
from app.services.theme.theme_modifier import apply_generated_texts
from app.services.theme.theme_translator import translate_remaining_texts
from app.services.theme.theme_exporter import export_theme
from app.utils.json_handler import read_theme_json, detect_json_format

# ── Auth dependency ───────────────────────────────────────────────────────────

def verify_token(x_api_token: str = Header(default="")) -> None:
    """Vérifie le token d'API si API_TOKEN est configuré dans .env."""
    if settings.api_token and x_api_token != settings.api_token:
        raise HTTPException(status_code=401, detail="Token d'API invalide ou manquant.")

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
    if not extract_dir.exists():
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


@router.post("/upload", response_model=UploadResponse)
async def upload_theme(theme_file: UploadFile = File(...)):
    """Upload a Shopify theme ZIP file and parse its structure."""
    if not theme_file.filename or not theme_file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Le fichier doit etre un ZIP")

    content = await theme_file.read()

    temp_zip = settings.temp_path / f"upload_{theme_file.filename}"
    settings.temp_path.mkdir(parents=True, exist_ok=True)
    with open(temp_zip, "wb") as f:
        f.write(content)

    try:
        structure = extract_theme(temp_zip)
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
    except Exception:
        pass  # Non-fatal: session will still work if server doesn't restart

    return UploadResponse(
        session_id=structure.session_id,
        theme_name=structure.theme_name,
        sections_count=structure.sections_count,
        templates_found=structure.templates_found,
    )


@router.post("/generate")
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

    session["language"] = language
    session["target_gender"] = target_gender
    session["store_name"] = store_name

    try:
        parsed_product_names = json.loads(product_names)
        if not isinstance(parsed_product_names, list):
            parsed_product_names = [product_names]
    except json.JSONDecodeError:
        parsed_product_names = [product_names]

    image_paths: list[Path] = []
    images_dir = settings.temp_path / session_id / "_product_images"
    if product_images:
        images_dir.mkdir(parents=True, exist_ok=True)
        for img in product_images:
            if img.content_type and img.content_type in ALLOWED_IMAGE_TYPES and img.filename:
                img_path = images_dir / img.filename
                with open(img_path, "wb") as f:
                    f.write(await img.read())
                image_paths.append(img_path)

    async def event_stream():
        all_results = {}
        has_any_success = False

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

        if not has_any_success:
            error_step = GenerationStep(
                step="preview",
                status="error",
                message="Aucun texte n'a pu etre genere. Verifiez votre cle API et le modele configure.",
            )
            yield f"data: {error_step.model_dump_json()}\n\n"
            return

        session["generated_texts"] = all_results
        _save_session_meta(session_id, session)

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

        await theme_history_add({
            "id": str(uuid.uuid4()),
            "filename": zip_path.name,
            "store_name": store_name,
            "created_at": datetime.now().isoformat(),
            "zip_path": str(zip_path),
        })

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
async def get_history():
    """Return list of all generated themes (most recent first)."""
    entries = await theme_history_list()
    return [
        {
            "id": e["id"],
            "filename": e["filename"],
            "store_name": e["store_name"],
            "created_at": e["created_at"],
            "available": Path(e["zip_path"]).exists(),
        }
        for e in entries
    ]


@router.get("/history/{history_id}/download")
async def download_history_item(history_id: str):
    """Download a theme from history by its ID."""
    entry = await theme_history_get(history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Fichier non trouvé dans l'historique.")
    zip_path = Path(entry["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Fichier ZIP introuvable sur le serveur.")
    return FileResponse(path=zip_path, media_type="application/zip", filename=entry["filename"])


@router.delete("/history/{history_id}")
async def delete_history_item(history_id: str):
    """Delete a single history entry and its ZIP file."""
    entry = await theme_history_get(history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée non trouvée.")
    zip_path = Path(entry["zip_path"])
    if zip_path.exists():
        zip_path.unlink()
    await theme_history_delete(history_id)
    return {"status": "deleted"}


@router.delete("/history")
async def clear_history():
    """Delete all history entries and their ZIP files."""
    entries = await theme_history_list()
    for entry in entries:
        zip_path = Path(entry["zip_path"])
        if zip_path.exists():
            zip_path.unlink()
    await theme_history_clear()
    return {"status": "cleared"}


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
