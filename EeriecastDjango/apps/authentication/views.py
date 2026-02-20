import uuid
import logging

from rest_framework import status, generics, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.authtoken.models import Token
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.common.utils import strip_non_model_fields
from .models import User
from apps.emails import events as email_events
from .serializers import (
    UserSerializer,
    SimpleUserSerializer,
    LoginSerializer,
    RegisterSerializer,
)

logger = logging.getLogger(__name__)

# ---------------------------
# Function-based auth views (kept for backwards compatibility)
# ---------------------------
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        UserModel = get_user_model()
        deleted_user = UserModel.objects.filter(email=email, is_deleted=True).first()
        if deleted_user:
            return Response({
                'error': 'account_deleted',
                'message': 'This account has been deleted.'
            }, status=status.HTTP_403_FORBIDDEN)

        user = authenticate(email=email, password=password)

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': UserSerializer(user).data
            })
        
        # Check if user exists but is imported from memberful and has no usable password
        imported_user = UserModel.objects.filter(email=email, is_imported_from_memberful=True).first()
        if imported_user and not imported_user.has_usable_password():
             return Response({
                'error': 'imported_user',
                'message': 'Your account was imported from Memberful. Please set a password to continue.'
            }, status=status.HTTP_403_FORBIDDEN)

        return Response({'error': 'Invalid credentials'}, status=400)
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        try:
            email_events.send_account_created_verify(user_id=user.id, to_email=user.email)
        except Exception:
            # Email failures must not break registration.
            logger.exception(f"Failed to send verification email to {user.email}")
        refresh = RefreshToken.for_user(user)
        return Response({
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'user': UserSerializer(user).data
        }, status=201)
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    return Response({'message': 'Logged out successfully'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_email_confirm(request):
    token = request.data.get('token')
    if not token:
        return Response({'token': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    signer = TimestampSigner(salt=email_events.VERIFY_EMAIL_SALT)
    try:
        user_id_str = signer.unsign(token, max_age=60 * 60 * 24 * 7)
        user_id = int(user_id_str)
    except SignatureExpired:
        return Response({'detail': 'Verification link expired.'}, status=status.HTTP_400_BAD_REQUEST)
    except (BadSignature, ValueError):
        return Response({'detail': 'Invalid verification token.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(id=user_id).first()
    if not user or getattr(user, 'is_deleted', False):
        return Response({'detail': 'Invalid verification token.'}, status=status.HTTP_400_BAD_REQUEST)

    if not getattr(user, 'email_verified', False):
        user.email_verified = True
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified', 'email_verified_at', 'updated_at'])
        try:
            email_events.send_account_verified(user_id=user.id, to_email=user.email)
        except Exception:
            logger.exception(f"Failed to send account verified email to {user.email}")

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_request(request):
    email = request.data.get('email')
    if email:
        email = email.lower().strip()

    # Non-enumerating response
    response_payload = {'detail': 'If an account exists, a password reset email has been sent.'}
    if not email:
        return Response(response_payload, status=status.HTTP_200_OK)

    user = User.objects.filter(email=email, is_active=True, is_deleted=False).first()
    if not user:
        return Response(response_payload, status=status.HTTP_200_OK)

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = PasswordResetTokenGenerator().make_token(user)
    reset_url = f"{settings.REACT_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

    try:
        email_events.send_password_reset_link(user_id=user.id, to_email=user.email, reset_url=reset_url)
    except Exception:
        logger.exception(f"Failed to send password reset email to {email}")

    return Response(response_payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    uid = request.data.get('uid')
    token = request.data.get('token')
    new_password = request.data.get('password')

    if not uid or not token or not new_password:
        return Response({'detail': 'uid, token, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({'detail': 'Invalid reset token.'}, status=status.HTTP_400_BAD_REQUEST)

    if getattr(user, 'is_deleted', False) or not user.is_active:
        return Response({'detail': 'Invalid reset token.'}, status=status.HTTP_400_BAD_REQUEST)

    if not PasswordResetTokenGenerator().check_token(user, token):
        return Response({'detail': 'Invalid reset token.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save(update_fields=['password', 'updated_at'])

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

# ---------------------------
# Migrated UserViewSet
# ---------------------------
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-id').exclude(is_superuser=True).exclude(is_deleted=True)
    serializer_class = UserSerializer

    def get_permissions(self):
        allow_any_actions = [
            'create',
            'request_my_password_reset',  # placeholder for potential future endpoints
            'verify_password_token',      # placeholder
            'confirm_password_token',     # placeholder
            'authenticate',
            'update_user'
        ]
        if self.action in allow_any_actions:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_object(self):
        pk = self.kwargs.get('pk')
        if pk == 'me':
            self.kwargs['pk'] = self.request.user.id
        return super().get_object()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = SimpleUserSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = SimpleUserSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        self.get_serializer(data=request.data).is_valid(raise_exception=True)
        user_data = strip_non_model_fields(request.data, User)
        # username required by AbstractUser; generate if missing
        if not user_data.get('username'):
            import uuid
            user_data['username'] = str(uuid.uuid4())
        user = User.objects.create_user(**user_data)
        token = Token.objects.create(user=user)
        try:
            email_events.send_account_created_verify(user_id=user.id, to_email=user.email)
        except Exception:
            logger.exception(f"Failed to send verification email to {user.email}")
        return Response({'user': {
            **UserSerializer(user, context={'request': request}).data,
            'token': token.key
        }}, status=201)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        old_email = getattr(user, 'email', None)
        self.get_serializer(user, data=request.data, partial=True).is_valid(raise_exception=True)
        user_data = strip_non_model_fields(request.data, User)
        for key, value in user_data.items():
            setattr(user, key, value)
        user.save()

        new_email = getattr(user, 'email', None)
        if old_email and new_email and old_email != new_email:
            try:
                email_events.send_email_changed_notifications(user_id=user.id, old_email=old_email, new_email=new_email)
            except Exception:
                logger.exception(f"Failed to send email change notifications for user {user.id}")
        return Response(UserSerializer(user, context={'request': request}).data, status=200)

    @action(detail=False, methods=['post'], url_path='me/delete', url_name='me-delete')
    def delete_me(self, request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=401)

        now = timezone.now()
        current_email = getattr(user, 'email', '')
        try:
            email_events.send_account_deleted_confirmation(
                user_id=user.id,
                to_email=current_email,
                deleted_at_iso=now.isoformat(),
            )
        except Exception:
            logger.exception(f"Failed to send account deletion confirmation for user {user.id}")

        tombstone_email = f"deleted+{uuid.uuid4()}@eeriecast.invalid"
        user.email_at_deletion = current_email
        user.email = tombstone_email
        user.is_active = False
        user.is_deleted = True
        user.deleted_at = now
        user.set_unusable_password()
        user.save(update_fields=[
            'email_at_deletion',
            'email',
            'is_active',
            'is_deleted',
            'deleted_at',
            'password',
            'updated_at',
        ])
        # Best-effort cleanup for DRF token auth (JWT tokens are stateless).
        try:
            manager = getattr(Token, 'objects', None)
            if manager is not None:
                manager.filter(user=user).delete()
        except Exception:
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='authenticate', url_name='authenticate')
    def authenticate(self, request, *args, **kwargs):
        validated_user = LoginSerializer(data=request.data)
        validated_user.is_valid(raise_exception=True)
        email = validated_user.validated_data['email']
        password = validated_user.validated_data['password']

        deleted_user = User.objects.filter(email=email, is_deleted=True).first()
        if deleted_user:
            return Response({
                'error': 'account_deleted',
                'message': 'This account has been deleted.'
            }, status=status.HTTP_403_FORBIDDEN)

        user = authenticate(email=email, password=password)
        if not user:
            # Check if user exists but is imported from memberful and has no usable password
            imported_user = User.objects.filter(email=email, is_imported_from_memberful=True).first()
            if imported_user and not imported_user.has_usable_password():
                return Response({
                    'error': 'imported_user',
                    'message': 'Your account was imported from Memberful. Please set a password to continue.'
                }, status=status.HTTP_403_FORBIDDEN)
            return Response({'error': 'Invalid credentials'}, status=400)
        token, _ = Token.objects.get_or_create(user=user)
        response_data = {**UserSerializer(user, context={'request': request}).data, 'token': token.key}
        return Response({'user': response_data}, status=200)

    @action(detail=False, methods=['post', 'patch'], url_path='me/update-user', url_name='update-user')
    def update_user(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        if not user:
            return Response({'detail': 'Authentication required'}, status=401)
        # Map legacy field name profile_picture -> avatar if present
        avatar_val = request.data.get('profile_picture') or request.data.get('avatar')
        if avatar_val is not None:
            user.avatar = avatar_val
            user.save()
        return Response(UserSerializer(user, context={'request': request}).data, status=200)

    @action(detail=False, methods=['get'], url_path='me', url_name='me')
    def me_endpoint(self, request, *args, **kwargs):
        return Response(UserSerializer(request.user, context={'request': request}).data, status=200)

    @action(detail=False, methods=['post'], url_path='me/authenticated-change-password', url_name='authenticated-change-password')
    def authenticated_change_password(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=401)
        current_password = request.data.get('current_password')
        new_password = request.data.get('password')
        if not current_password:
            return Response({'current_password': ['This field is required.']}, status=400)
        if not new_password:
            return Response({'password': ['This field is required.']}, status=400)
        if not request.user.check_password(current_password):
            return Response({'current_password': ['Current password is incorrect.']}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response(status=200)
