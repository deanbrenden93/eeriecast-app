from django.urls import path
from . import views

urlpatterns = [
    path('', views.global_search, name='global-search'),
    path('podcasts/', views.search_podcasts, name='search-podcasts'),
    path('episodes/', views.search_episodes, name='search-episodes'),
    path('creators/', views.search_creators, name='search-creators'),
]
