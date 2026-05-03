"""Serializers for admin outreach endpoints.

Kept deliberately small — the heavy lifting (filtering the user
queryset, streaming CSV, fanning out notifications) lives in views and
tasks. These serializers only validate inbound payloads.
"""
from urllib.parse import urlparse

from rest_framework import serializers


class NotificationBroadcastSerializer(serializers.Serializer):
    """Inbound payload for ``POST /api/admin/notifications/broadcast/``.

    The frontend sends ``{title, body, url?}``; we map ``body`` to the
    model's ``message`` field and validate that the URL (if present) is
    either an internal path or a plain ``http(s)`` absolute URL. Any
    other scheme (``javascript:``, ``data:``, etc.) is rejected so an
    admin can't accidentally ship an XSS-shaped link to every user.
    """

    title = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=120,
        trim_whitespace=True,
    )
    body = serializers.CharField(
        required=True,
        max_length=2000,  # generous; the UI counter caps at 280
        trim_whitespace=True,
    )
    url = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        trim_whitespace=True,
    )

    def validate_url(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            return ""
        # Internal path — must start with a single slash. ``//evil.com``
        # is a protocol-relative URL that some browsers treat as
        # external; reject it.
        if v.startswith("/") and not v.startswith("//"):
            return v
        parsed = urlparse(v)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return v
        raise serializers.ValidationError(
            "URL must start with '/' (internal path) or be an absolute http(s):// URL."
        )

    def validate(self, attrs):
        title = (attrs.get("title") or "").strip()
        body = (attrs.get("body") or "").strip()
        if not title and not body:
            raise serializers.ValidationError(
                "A notification needs at least a title or a body."
            )
        attrs["title"] = title
        attrs["body"] = body
        attrs["url"] = (attrs.get("url") or "").strip()
        return attrs
