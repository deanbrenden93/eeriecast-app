from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'subscriptions', views.SubscriptionViewSet, basename='subscription')

urlpatterns = [
    path('me/', views.me_status, name='billing-me-status'),
    path('subscriptions/upsert/', views.upsert_subscription, name='billing-upsert-subscription'),
    path('', include(router.urls)),
]
