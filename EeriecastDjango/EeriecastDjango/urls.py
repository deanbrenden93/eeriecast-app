"""
URL configuration for EeriecastDjango project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/podcasts/', include('apps.podcasts.urls')),
    path('api/episodes/', include('apps.episodes.urls')),
    path('api/creators/', include('apps.creators.urls')),
    path('api/categories/', include('apps.categories.urls')),
    path('api/library/', include('apps.library.urls')),
    path('api/search/', include('apps.search.urls')),
    path('api/integrations/', include('apps.integrations.urls')),
    path('api/billing/', include('apps.billing.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
