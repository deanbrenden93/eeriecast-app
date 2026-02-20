from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import EmailEvent, CeleryTaskLog


@admin.register(EmailEvent)
class EmailEventAdmin(ModelAdmin):
    list_display = (
        "id",
        "event_type",
        "to_email",
        "status",
        "user",
        "external_id",
        "sent_at",
        "created_at",
    )
    list_filter = ("status", "event_type", "created_at")
    search_fields = (
        "to_email",
        "external_id",
        "provider_message_id",
        "user__email",
        "user__username",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "email_backend",
        "email_host",
        "email_port",
        "email_host_user",
        "email_use_tls",
        "email_use_ssl",
    )
    ordering = ("-created_at",)
    list_select_related = ("user",)


@admin.register(CeleryTaskLog)
class CeleryTaskLogAdmin(ModelAdmin):
    list_display = (
        "id",
        "task_name",
        "status",
        "worker",
        "started_at",
        "finished_at",
    )
    list_filter = ("status", "task_name", "worker", "started_at")
    search_fields = ("task_name", "task_id", "worker", "error", "stack_trace")
    readonly_fields = (
        "task_name",
        "task_id",
        "args",
        "kwargs",
        "worker",
        "result",
        "status",
        "error",
        "stack_trace",
        "started_at",
        "finished_at",
    )
    ordering = ("-started_at",)
