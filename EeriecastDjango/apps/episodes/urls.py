from django.urls import path
from . import views

urlpatterns = [
    path('', views.EpisodeListCreateView.as_view(), name='episode-list'),
    path('trending/', views.TrendingEpisodeListView.as_view(), name='episode-trending'),
    path('recommended/', views.RecommendedEpisodeListView.as_view(), name='episode-recommended'),
    path('<int:pk>/', views.EpisodeDetailView.as_view(), name='episode-detail'),
]
