"""URL routes for admin-only outreach tooling.

Mounted at ``/api/admin/`` from ``EeriecastDjango/urls.py``. Every view
gates on ``IsAuthenticated + IsStaffSuperuser`` — same gate as the
existing analytics endpoints, since these surfaces handle PII (email
exports) and write to every user's notification feed (broadcasts).
"""
from django.urls import path

from . import views

app_name = "admin_tools"

urlpatterns = [
    # Email export — CSV download of users' email + profile fields,
    # filtered by `verified_only` query param. Pair `audience/` with
    # `export/` so the UI can show a recipient count before
    # committing to the download.
    path("emails/audience/", views.EmailAudienceView.as_view(), name="emails-audience"),
    path("emails/export/", views.EmailExportView.as_view(), name="emails-export"),

    # Notification broadcast — POST a {title, body, url?} payload and
    # the server fans out a Notification row to every active user via
    # a Celery task.
    path("notifications/audience/", views.NotificationAudienceView.as_view(), name="notifications-audience"),
    path("notifications/broadcast/", views.NotificationBroadcastView.as_view(), name="notifications-broadcast"),
]
