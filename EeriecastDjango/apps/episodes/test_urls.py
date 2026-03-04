from django.urls import include, path


urlpatterns = [
    path("api/episodes/", include("apps.episodes.urls")),
]
