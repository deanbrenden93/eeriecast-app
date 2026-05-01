"""
Analytics-only persistence.

Holds tables we exist purely to drive the admin dashboard. Anything
that the rest of the app needs to read should live in its domain app
instead — these models are deliberately quarantined here so analytics
infrastructure can evolve (or be torn out and replaced with an
external warehouse) without touching the rest of the codebase.
"""
import uuid

from django.db import models


class AnonymousSession(models.Model):
    """
    Tracks unique anonymous (logged-out) visitors so the admin
    dashboard can answer "how many not-signed-in people visited in
    the last 24h?".

    A random UUID is set in a long-lived cookie by
    AnonymousActivityMiddleware on the first request from a given
    browser. Each subsequent unauthenticated request through that
    cookie bumps ``last_seen_at`` (throttled via cache to one write
    per session per minute, the same way authenticated users are
    handled).

    We deliberately store nothing identifying — no IP, no
    user-agent — because this table only has to support a
    "distinct sessions seen in the last N hours" count. If a more
    detailed analytics need shows up later, we can add fields then;
    for now keeping it minimal sidesteps any data-retention
    questions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    last_seen_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self) -> str:
        return f"AnonymousSession({self.id} last_seen={self.last_seen_at:%Y-%m-%d %H:%M})"
