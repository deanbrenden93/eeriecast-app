from django.urls import path
from . import views

urlpatterns = [
    path('', views.EpisodeListCreateView.as_view(), name='episode-list'),
    path('<int:pk>/', views.EpisodeDetailView.as_view(), name='episode-detail'),
]
