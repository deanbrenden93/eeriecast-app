from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')

urlpatterns = [
    # Existing function-based endpoints
    path('login/', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('me/', views.UserProfileView.as_view(), name='user-profile'),

    # Email verification + password reset
    path('verify-email/confirm/', views.verify_email_confirm, name='verify-email-confirm'),
    path('password-reset/request/', views.password_reset_request, name='password-reset-request'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password-reset-confirm'),

    # Router endpoints for UserViewSet
    path('', include(router.urls)),
]
