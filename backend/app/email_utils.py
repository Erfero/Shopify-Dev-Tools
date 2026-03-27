"""Optional email helper — sends notifications via SMTP.

Requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD to be set in the environment.
If not configured, notifications are silently skipped (logged at INFO level).
"""
import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


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
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = "Votre compte a été approuvé — Shopify Dev Tools"
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = to_email

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)

        logger.info("Approval email sent to %s", to_email)
    except Exception as e:
        logger.warning("Failed to send approval email to %s: %s", to_email, e)
