from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'subscriptions', views.SubscriptionViewSet, basename='subscription')

urlpatterns = [
    path('me/', views.me_status, name='billing-me-status'),
    path('cancel/', views.cancel_subscription, name='billing-cancel-subscription'),
    path('subscriptions/upsert/', views.upsert_subscription, name='billing-upsert-subscription'),
    path('start-trial/', views.start_trial_custom, name='billing-start-trial-custom'),
    path('create-checkout-session/', views.create_checkout_session, name='billing-create-checkout-session'),
    path('create-portal-session/', views.create_portal_session, name='billing-create-portal-session'),
    path('update-payment-method/', views.update_payment_method, name='billing-update-payment-method'),
    path('webhook/', views.stripe_webhook, name='billing-stripe-webhook'),
    path('', include(router.urls)),
]
