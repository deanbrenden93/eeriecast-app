from django.urls import path
from . import views

urlpatterns = [
    path('', views.CreatorListCreateView.as_view(), name='creator-list'),
    path('featured/', views.FeaturedCreatorListView.as_view(), name='creator-featured'),
    path('<int:pk>/', views.CreatorDetailView.as_view(), name='creator-detail'),
]
