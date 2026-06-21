"""Optional email helper — sends notifications via SMTP.

Requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD to be set in the environment.
If not configured, notifications are silently skipped (logged at INFO level).
"""
import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _send(to_email: str, subject: str, body: str) -> None:
    """Low-level SMTP send — raises on failure."""
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


async def send_approval_email(to_email: str, display_name: str) -> None:
    """Send an approval notification email to a newly approved user."""
    if not settings.smtp_host or not settings.smtp_user:
        logger.info("SMTP not configured — skipping approval email to %s", to_email)
        return
    try:
        body = (
            f"Bonjour {display_name},\n\n"
            "Votre compte Shopify Dev Tools a été approuvé par un administrateur.\n"
            "Vous pouvez maintenant vous connecter et utiliser les outils.\n\n"
            "Bonne utilisation !\n\n"
            "— L'équipe Shopify Dev Tools"
        )
        _send(to_email, "Votre compte a été approuvé — Shopify Dev Tools", body)
        logger.info("Approval email sent to %s", to_email)
    except Exception as e:
        logger.warning("Failed to send approval email to %s: %s", to_email, e)


async def send_reset_code_email(to_email: str, display_name: str, code: str) -> None:
    """Send a password reset code directly to the user's inbox."""
    if not settings.smtp_host or not settings.smtp_user:
        logger.info("SMTP not configured — reset code for %s is %s (visible in admin panel)", to_email, code)
        return
    try:
        reset_url = f"{settings.frontend_url}/reset-password"
        body = (
            f"Bonjour {display_name},\n\n"
            "Vous avez demandé la réinitialisation de votre mot de passe Shopify Dev Tools.\n\n"
            "Votre code de réinitialisation est :\n\n"
            f"        {code}\n\n"
            "Ce code est valable pendant 24 heures.\n\n"
            f"Rendez-vous sur : {reset_url}\n"
            "Entrez votre email, ce code, et choisissez un nouveau mot de passe.\n\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n"
            "— L'équipe Shopify Dev Tools"
        )
        _send(to_email, f"[{code}] Réinitialisation de votre mot de passe", body)
        logger.info("Reset code email sent to %s", to_email)
    except Exception as e:
        logger.warning("Failed to send reset code email to %s: %s", to_email, e)
