from django.apps import AppConfig

class LibraryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.library'

    def ready(self):
        # Wire post_save / post_delete handlers that bust the
        # recommendation-profile cache on follow / favorite / new
        # listening-history rows. Importing inside ready() (and not
        # at module top) is the standard Django pattern that avoids
        # touching models before the app registry is built.
        from . import signals  # noqa: F401
