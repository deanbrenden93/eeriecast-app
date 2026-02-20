from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings


def _rgb_str_to_hex(rgb: str) -> str:
    parts = [p.strip() for p in rgb.split(",")]
    if len(parts) != 3:
        raise ValueError(f"Invalid rgb string: {rgb!r}")
    r, g, b = (max(0, min(255, int(p))) for p in parts)
    return f"#{r:02X}{g:02X}{b:02X}"


@dataclass(frozen=True)
class EmailTheme:
    background: str
    card_background: str
    text: str
    subtle_text: str
    border: str
    primary: str
    button_text: str


def get_email_theme() -> EmailTheme:
    """Derive email theme colors from settings.UNFOLD['COLORS'].

    UNFOLD stores colors as RGB strings for base/primary, and hex/vars for font.
    """
    unfold: dict[str, Any] = getattr(settings, "UNFOLD", {}) or {}
    colors: dict[str, Any] = unfold.get("COLORS", {}) or {}

    base = colors.get("base", {}) or {}
    primary = colors.get("primary", {}) or {}
    font = colors.get("font", {}) or {}

    # Fallbacks are chosen to be readable even if UNFOLD isn't configured.
    background = _rgb_str_to_hex(base.get("50", "250, 250, 250"))
    border = _rgb_str_to_hex(base.get("200", "220, 220, 220"))
    text = _rgb_str_to_hex(base.get("900", "20, 20, 20"))
    subtle_text = _rgb_str_to_hex(base.get("500", "100, 100, 100"))
    primary_hex = _rgb_str_to_hex(primary.get("500", "255, 193, 7"))
    button_text = font.get("default-light") or "#000000"

    return EmailTheme(
        background=background,
        card_background="#FFFFFF",
        text=text,
        subtle_text=subtle_text,
        border=border,
        primary=primary_hex,
        button_text=button_text,
    )
