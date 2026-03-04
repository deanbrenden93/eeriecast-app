from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings


@dataclass(frozen=True)
class EmailTheme:
    background: str
    card_background: str
    text: str
    subtle_text: str
    border: str
    primary: str
    button_text: str
    logo_url: str


def get_email_theme() -> EmailTheme:
    """Dark Eeriecast-branded palette for transactional emails."""
    return EmailTheme(
        background="#08080e",
        card_background="#111118",
        text="#e4e4eb",
        subtle_text="#71717a",
        border="#1f1f2e",
        primary="#dc2626",
        button_text="#ffffff",
        logo_url=getattr(settings, "EMAIL_LOGO_URL", ""),
    )
