from django.urls import path
from . import views

urlpatterns = [
    path('', views.PodcastListCreateView.as_view(), name='podcast-list'),
    path('<int:pk>/', views.PodcastDetailView.as_view(), name='podcast-detail'),
]
