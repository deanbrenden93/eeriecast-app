try:
    from .celery import app as celery_app
except ModuleNotFoundError:  # pragma: no cover
    # Celery is optional in some environments (e.g. minimal test runners).
    celery_app = None

__all__ = ("celery_app",)

