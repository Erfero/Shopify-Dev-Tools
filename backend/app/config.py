from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

# ── Model presets shared by both tools ────────────────────────────────────────
# free        → Llama 3.3 70B (text) + Llama 4 Maverick (vision) — 0$/génération
# paid        → Mistral Small 3.2 (text) + Llama 4 Maverick (vision)
# paid_premium → Gemini 2.5 Flash (text+vision)
# best        → Claude 3.7 Sonnet (text+vision)
MODEL_PRESETS = {
    "free": {
        "text_model": "meta-llama/llama-3.3-70b-instruct:free",
        "vision_model": "meta-llama/llama-4-maverick:free",
    },
    "paid": {
        "text_model": "mistralai/mistral-small-3.2-24b-instruct",
        "vision_model": "meta-llama/llama-4-maverick",
    },
    "paid_premium": {
        "text_model": "google/gemini-2.5-flash",
        "vision_model": "google/gemini-2.5-flash",
    },
    "best": {
        "text_model": "anthropic/claude-3.7-sonnet",
        "vision_model": "anthropic/claude-3.7-sonnet",
    },
    # Review generator legacy presets
    "paid_budget": {
        "text_model": "meta-llama/llama-3.3-70b-instruct",
        "vision_model": "anthropic/claude-3.7-sonnet",
    },
}


class Settings(BaseSettings):
    # ── Shared ──────────────────────────────────────────────────────────────
    openrouter_api_key: str = ""
    ai_preset: str = "paid_premium"
    ai_model: str = ""            # Override: if set, used for all text calls
    ai_vision_model: str = ""     # Override: if set, used for all vision calls
    use_mock: bool = False
    frontend_url: str = "http://localhost:3000"
    database_url: str = ""        # If set, uses PostgreSQL; else SQLite

    # ── Review generator specific ──────────────────────────────────────────
    imgbb_api_key: str = ""
    backend_url: str = "http://localhost:8000"

    # ── Theme customizer specific ──────────────────────────────────────────
    temp_dir: str = "./temp"
    session_ttl_seconds: int = 432000  # 5 days — matches output ZIP retention
    api_token: str = ""               # If set, all requests must include X-API-Token

    # ── Auth (JWT) ──────────────────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production-use-a-long-random-string"
    admin_email: str = ""             # This email is auto-approved as admin on registration

    # ── Email (SMTP) — optional, for approval notifications ─────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""               # Defaults to smtp_user if not set

    # ── Computed properties ─────────────────────────────────────────────────

    @property
    def text_model(self) -> str:
        """Model for text-only generation."""
        if self.ai_model:
            return self.ai_model
        preset = MODEL_PRESETS.get(self.ai_preset, MODEL_PRESETS["free"])
        return preset["text_model"]

    @property
    def vision_model(self) -> str:
        """Model for vision (image + text) generation."""
        if self.ai_vision_model:
            return self.ai_vision_model
        preset = MODEL_PRESETS.get(self.ai_preset, MODEL_PRESETS["free"])
        return preset["vision_model"]

    # Legacy alias used by review generator services
    @property
    def model(self) -> str:
        return self.text_model

    # Legacy uppercase aliases used by review generator services
    @property
    def OPENROUTER_API_KEY(self) -> str:
        return self.openrouter_api_key

    @property
    def AI_PRESET(self) -> str:
        return self.ai_preset

    @property
    def AI_MODEL(self) -> Optional[str]:
        return self.ai_model or None

    @property
    def AI_VISION_MODEL(self) -> str:
        return self.vision_model

    @property
    def IMGBB_API_KEY(self) -> str:
        return self.imgbb_api_key

    @property
    def FRONTEND_URL(self) -> str:
        return self.frontend_url

    @property
    def BACKEND_URL(self) -> str:
        return self.backend_url

    @property
    def USE_MOCK(self) -> bool:
        return self.use_mock

    @property
    def temp_path(self) -> Path:
        path = Path(self.temp_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    model_config = {"env_file": ".env"}


settings = Settings()
