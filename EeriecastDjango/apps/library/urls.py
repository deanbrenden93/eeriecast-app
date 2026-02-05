from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'playlists', views.PlaylistViewSet, basename='playlist')
router.register(r'followings/podcasts', views.PodcastFollowingViewSet, basename='podcast-following')
router.register(r'notifications', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('favorites/', views.FavoriteListCreateView.as_view(), name='favorite-list'),
    path('favorites/summary/', views.favorites_summary, name='favorites-summary'),
    path('favorites/<str:content_type>/<int:content_id>/', views.remove_favorite, name='remove-favorite'),
    path('following/', views.FollowingListCreateView.as_view(), name='following-list'),
    path('history/', views.ListeningHistoryListCreateView.as_view(), name='listening-history'),
    path('history/<int:episode_id>/', views.update_progress, name='update-progress'),
    path('history/resume/latest/', views.resume_latest, name='resume-latest'),
    path('history/resume/podcast/<int:podcast_id>/', views.resume_for_podcast, name='resume-for-podcast'),
    path('history/events/', views.log_playback_event, name='log-playback-event'),
    path('', include(router.urls)),
]
