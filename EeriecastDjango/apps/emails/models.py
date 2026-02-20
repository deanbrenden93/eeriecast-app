from django.conf import settings
from django.db import models


class EmailEvent(models.Model):
    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "pending"),
        (STATUS_SENT, "sent"),
        (STATUS_FAILED, "failed"),
    ]

    # Optional user link (useful for Stripe events resolved to a user).
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_events",
    )

    event_type = models.CharField(max_length=64)
    to_email = models.EmailField()

    # Email server details used at send time.
    email_backend = models.CharField(max_length=255, blank=True, default="")
    email_host = models.CharField(max_length=255, blank=True, default="")
    email_port = models.IntegerField(null=True, blank=True)
    email_host_user = models.CharField(max_length=255, blank=True, default="")
    email_use_tls = models.BooleanField(null=True, blank=True)
    email_use_ssl = models.BooleanField(null=True, blank=True)

    # Idempotency key (Stripe event.id, or an internal deterministic/uuid key).
    external_id = models.CharField(max_length=255, unique=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    sent_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=255, null=True, blank=True)
    error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event_type} -> {self.to_email} ({self.status})"


class CeleryTaskLog(models.Model):
    STATUS_PENDING = "pending"
    STATUS_SUCCESS = "success"
    STATUS_FAILURE = "failure"

    STATUS_CHOICES = [
        (STATUS_PENDING, "pending"),
        (STATUS_SUCCESS, "success"),
        (STATUS_FAILURE, "failure"),
    ]

    task_name = models.CharField(max_length=255)
    task_id = models.CharField(max_length=255, null=True, blank=True)
    args = models.JSONField(null=True, blank=True)
    kwargs = models.JSONField(null=True, blank=True)
    result = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    worker = models.CharField(max_length=255, null=True, blank=True)
    error = models.TextField(blank=True, null=True)
    stack_trace = models.TextField(blank=True, null=True)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Celery Task Log"
        verbose_name_plural = "Celery Task Logs"
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"{self.task_name} ({self.status}) at {self.started_at}"
