from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.AnalyticsSummaryView.as_view(), name="analytics-summary"),
    path("shows/", views.AnalyticsShowsView.as_view(), name="analytics-shows"),
    path("episodes/", views.AnalyticsEpisodesView.as_view(), name="analytics-episodes"),
    path(
        "episodes/<int:episode_id>/",
        views.AnalyticsEpisodeDetailView.as_view(),
        name="analytics-episode-detail",
    ),
    path("audiobooks/", views.AnalyticsAudiobooksView.as_view(), name="analytics-audiobooks"),
]
