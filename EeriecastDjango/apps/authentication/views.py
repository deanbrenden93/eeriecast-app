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
from .models import User, DOBChangeLog
from apps.emails import events as email_events
from .serializers import (
    UserSerializer,
    SimpleUserSerializer,
    LoginSerializer,
    RegisterSerializer,
)

logger = logging.getLogger(__name__)
EMAIL_CHANGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 2


def _client_ip_and_ua(request):
    """Extract client IP and User-Agent from a DRF request for audit logging.

    Honours ``X-Forwarded-For`` (first hop) when present, falling back to
    ``REMOTE_ADDR``. UA string is truncated to the column limit.
    """
    ua = (request.META.get('HTTP_USER_AGENT') or '')[:500]
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    ip = None
    if xff:
        ip = xff.split(',')[0].strip() or None
    if not ip:
        ip = request.META.get('REMOTE_ADDR') or None
    return ip, ua


def _parse_dob(value):
    """Parse a DOB input (ISO string or date) into a ``date`` or ``None``."""
    if value in (None, '', 'null'):
        return None
    if hasattr(value, 'year') and hasattr(value, 'month') and hasattr(value, 'day'):
        return value
    try:
        from datetime import date, datetime
        if isinstance(value, str):
            return datetime.strptime(value[:10], '%Y-%m-%d').date()
        if isinstance(value, date):
            return value
    except Exception:
        return None
    return None


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

        # Check if user exists but is imported from memberful and has no usable password
        # IMPORTANT: Do this BEFORE authenticate() to prevent any chance of login
        imported_user = UserModel.objects.filter(email=email, is_imported_from_memberful=True).first()
        if imported_user and not imported_user.has_usable_password():
            # Automatically send password reset email for imported users
            uid = urlsafe_base64_encode(force_bytes(imported_user.pk))
            token = PasswordResetTokenGenerator().make_token(imported_user)
            reset_url = f"{settings.REACT_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

            try:
                email_events.send_imported_user_welcome(
                    user_id=imported_user.id,
                    to_email=imported_user.email,
                    reset_url=reset_url
                )
            except Exception:
                logger.exception(f"Failed to send welcome email to imported user {email}")

            return Response({
                'error': 'imported_user_welcome',
                'message': 'Welcome to the new EERIECAST! We\'ve sent you an email to set up your password.',
                'email': email
            }, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(email=email, password=password)

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': UserSerializer(user).data
            })

        return Response({
            'error': 'invalid_credentials',
            'message': 'Invalid email or password. Please try again.'
        }, status=status.HTTP_400_BAD_REQUEST)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data.get('email', '').lower().strip()

        # Check if this email belongs to an imported user without a password
        UserModel = get_user_model()
        imported_user = UserModel.objects.filter(email=email, is_imported_from_memberful=True).first()
        if imported_user and not imported_user.has_usable_password():
            # Automatically send password reset email for imported users
            uid = urlsafe_base64_encode(force_bytes(imported_user.pk))
            token = PasswordResetTokenGenerator().make_token(imported_user)
            reset_url = f"{settings.REACT_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

            try:
                email_events.send_imported_user_welcome(
                    user_id=imported_user.id,
                    to_email=imported_user.email,
                    reset_url=reset_url
                )
            except Exception:
                logger.exception(f"Failed to send welcome email to imported user {email}")

            return Response({
                'error': 'imported_user_welcome',
                'message': 'Welcome back! We found your account from Memberful. Check your email to set up your password.',
                'email': email
            }, status=status.HTTP_400_BAD_REQUEST)

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
@permission_classes([permissions.IsAuthenticated])
def verify_password(request):
    """Confirm the currently authenticated user's password.

    Used as a step-up check before sensitive profile actions (e.g. editing a
    date of birth that's already on file). Returns ``{ok: true}`` on match,
    400 otherwise. Does NOT issue or rotate any tokens.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    password = request.data.get('password')
    if not password:
        return Response({'password': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
    if not user.has_usable_password():
        return Response({'detail': 'This account has no password set.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(password):
        return Response({'password': ['Current password is incorrect.']}, status=status.HTTP_400_BAD_REQUEST)
    return Response({'ok': True}, status=status.HTTP_200_OK)


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
def resend_verification(request):
    """Re-send the email-verification link for an unverified account.

    Accepts either an authenticated request (uses request.user) or an
    unauthenticated POST with `{ "email": "..." }`. Always returns 200 with
    the same payload to avoid leaking which emails have accounts. Rate-limited
    to once per 60 seconds per email via the Django cache.
    """
    from django.core.cache import cache

    target_email: str | None = None
    if request.user and request.user.is_authenticated:
        target_email = getattr(request.user, 'email', None)
    if not target_email:
        target_email = (request.data.get('email') or '').strip().lower() or None

    generic_ok = Response(
        {'detail': 'If that account exists and is unverified, we just sent a new verification email.'},
        status=status.HTTP_200_OK,
    )

    if not target_email:
        return generic_ok

    cache_key = f"verify_resend:{target_email}"
    if cache.get(cache_key):
        # Still 200 — we don't want to advertise rate-limit state either, but we
        # do skip the actual send to avoid spamming a single inbox.
        return generic_ok
    cache.set(cache_key, 1, timeout=60)

    user = User.objects.filter(email__iexact=target_email).first()
    if not user or getattr(user, 'is_deleted', False) or not getattr(user, 'is_active', True):
        return generic_ok
    if getattr(user, 'email_verified', False):
        return generic_ok

    try:
        email_events.resend_account_created_verify(user_id=user.id, to_email=user.email)
    except Exception:
        logger.exception(f"Failed to enqueue resend of verification email to {user.email}")

    return generic_ok


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def request_email_change(request):
    user = request.user
    if not user.is_authenticated:
        return Response({'detail': 'Authentication required'}, status=401)
    if getattr(user, 'is_deleted', False) or not getattr(user, 'is_active', True):
        return Response({'detail': 'Invalid account.'}, status=status.HTTP_400_BAD_REQUEST)

    new_email = request.data.get('email')
    current_password = request.data.get('current_password')
    if not new_email:
        return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
    if not current_password:
        return Response({'current_password': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    new_email = str(new_email).lower().strip()
    current_email = getattr(user, 'email', '').lower().strip()
    if not new_email:
        return Response({'email': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
    if new_email == current_email:
        return Response({'email': ['That is already your current email.']}, status=status.HTTP_400_BAD_REQUEST)

    if not user.has_usable_password():
        return Response({'detail': 'A password is required to change your email.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(current_password):
        return Response({'current_password': ['Current password is incorrect.']}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
        return Response({'email': ['That email is already in use.']}, status=status.HTTP_400_BAD_REQUEST)

    user.pending_email = new_email
    user.pending_email_requested_at = timezone.now()
    user.save(update_fields=['pending_email', 'pending_email_requested_at', 'updated_at'])

    signer = TimestampSigner(salt=email_events.EMAIL_CHANGE_SALT)
    token = signer.sign(f"{user.id}:{new_email}")
    verify_url = f"{settings.REACT_BASE_URL.rstrip('/')}/confirm-email-change?token={token}"

    try:
        email_events.send_email_change_verification(
            user_id=user.id,
            to_email=new_email,
            new_email=new_email,
            verify_url=verify_url,
        )
    except Exception:
        logger.exception(f"Failed to send email change verification to {new_email}")

    try:
        email_events.send_email_change_requested_old(
            user_id=user.id,
            to_email=current_email,
            new_email=new_email,
        )
    except Exception:
        logger.exception(f"Failed to send email change requested notice to {current_email}")

    return Response({'detail': 'Verification sent to new email.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def confirm_email_change(request):
    token = request.data.get('token')
    if not token:
        return Response({'token': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)

    signer = TimestampSigner(salt=email_events.EMAIL_CHANGE_SALT)
    try:
        payload = signer.unsign(token, max_age=EMAIL_CHANGE_MAX_AGE_SECONDS)
        user_id_str, new_email = payload.split(":", 1)
        user_id = int(user_id_str)
    except SignatureExpired:
        return Response({'detail': 'Verification link expired.'}, status=status.HTTP_400_BAD_REQUEST)
    except (BadSignature, ValueError):
        return Response({'detail': 'Invalid verification token.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(id=user_id).first()
    if not user or getattr(user, 'is_deleted', False):
        return Response({'detail': 'Invalid verification token.'}, status=status.HTTP_400_BAD_REQUEST)

    pending = (user.pending_email or "").lower().strip()
    if not pending or pending != new_email.lower().strip():
        return Response({'detail': 'This verification link is no longer valid.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
        return Response({'detail': 'That email is already in use.'}, status=status.HTTP_400_BAD_REQUEST)

    old_email = getattr(user, 'email', None)
    user.email = new_email
    user.email_verified = True
    user.email_verified_at = timezone.now()
    user.pending_email = None
    user.pending_email_requested_at = None
    user.save(update_fields=[
        'email',
        'email_verified',
        'email_verified_at',
        'pending_email',
        'pending_email_requested_at',
        'updated_at',
    ])

    if old_email and old_email != new_email:
        try:
            email_events.send_email_changed_notifications(user_id=user.id, old_email=old_email, new_email=new_email)
        except Exception:
            logger.exception(f"Failed to send email change notifications for user {user.id}")

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

    def update(self, request, *args, **kwargs):
        if request.data.get('email') is not None:
            return Response(
                {'email': ['Use the email change flow to update your email address.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = self.get_object()
        # Capture the prior DOB BEFORE the serializer runs so we can audit a
        # change. ``request.data`` may contain ``date_of_birth`` as an ISO
        # string; the serializer coerces it to a ``date`` on the model.
        # First-time sets (prior value is None) don't require password
        # re-auth; subsequent changes MUST have already been password-
        # verified by the frontend via the verify-password endpoint.
        prior_dob = getattr(user, 'date_of_birth', None)
        incoming_has_dob = 'date_of_birth' in request.data
        incoming_dob = _parse_dob(request.data.get('date_of_birth')) if incoming_has_dob else None
        dob_is_changing = incoming_has_dob and (incoming_dob != prior_dob)

        # Enforce: if a DOB is already on file, only allow overwriting it
        # when the request carries a ``dob_password_verified`` flag (set by
        # the frontend after calling /auth/verify-password/ in the same
        # session). This is belt-and-suspenders defense against a client
        # bypassing the UI gate.
        if dob_is_changing and prior_dob is not None:
            if not bool(request.data.get('dob_password_verified')):
                return Response(
                    {'date_of_birth': ['Password re-verification required to change date of birth.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        response = super().update(request, *args, **kwargs)

        if dob_is_changing and response.status_code < 400:
            ip, ua = _client_ip_and_ua(request)
            try:
                DOBChangeLog.objects.create(
                    user=user,
                    old_value=prior_dob,
                    new_value=incoming_dob,
                    password_verified=bool(request.data.get('dob_password_verified')),
                    ip_address=ip,
                    user_agent=ua,
                )
            except Exception:
                logger.exception("Failed to write DOBChangeLog for user %s", user.id)

        return response

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
        if request.data.get('email') is not None:
            return Response(
                {'email': ['Use the email change flow to update your email address.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mirror the DOB audit / password-gate from UserProfileView so both
        # update entrypoints enforce the same policy.
        prior_dob = getattr(user, 'date_of_birth', None)
        incoming_has_dob = 'date_of_birth' in request.data
        incoming_dob = _parse_dob(request.data.get('date_of_birth')) if incoming_has_dob else None
        dob_is_changing = incoming_has_dob and (incoming_dob != prior_dob)
        if dob_is_changing and prior_dob is not None and not bool(request.data.get('dob_password_verified')):
            return Response(
                {'date_of_birth': ['Password re-verification required to change date of birth.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.get_serializer(user, data=request.data, partial=True).is_valid(raise_exception=True)
        user_data = strip_non_model_fields(request.data, User)
        for key, value in user_data.items():
            setattr(user, key, value)
        user.save()

        if dob_is_changing:
            ip, ua = _client_ip_and_ua(request)
            try:
                DOBChangeLog.objects.create(
                    user=user,
                    old_value=prior_dob,
                    new_value=incoming_dob,
                    password_verified=bool(request.data.get('dob_password_verified')),
                    ip_address=ip,
                    user_agent=ua,
                )
            except Exception:
                logger.exception("Failed to write DOBChangeLog for user %s", user.id)

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

        # Cancel active Stripe subscriptions before deleting the account.
        if getattr(user, 'stripe_customer_id', None) and getattr(settings, 'STRIPE_SECRET_KEY', None):
            try:
                import stripe
                stripe.api_key = settings.STRIPE_SECRET_KEY
                subs = stripe.Subscription.list(customer=user.stripe_customer_id, status="all", limit=100)
                for sub in getattr(subs, "data", []) or []:
                    status_val = getattr(sub, "status", None) or sub.get("status")
                    if status_val in {"canceled", "incomplete_expired"}:
                        continue
                    stripe.Subscription.delete(sub.id)
            except Exception:
                logger.exception("Failed to cancel Stripe subscriptions for user %s", user.id)
                return Response(
                    {'detail': 'Unable to cancel active subscription. Please contact support.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        now = timezone.now()
        local_now = timezone.localtime(now)
        deleted_at_display = local_now.strftime("%B %d, %Y at %I:%M %p").replace(" 0", " ")
        current_email = getattr(user, 'email', '')
        try:
            email_events.send_account_deleted_confirmation(
                user_id=user.id,
                to_email=current_email,
                deleted_at_iso=now.isoformat(),
                deleted_at_display=deleted_at_display,
            )
        except Exception:
            logger.exception(f"Failed to send account deletion confirmation for user {user.id}")
        # Hard delete the user and cascade related data.
        user.delete()
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

        # Check if user exists but is imported from memberful and has no usable password
        # IMPORTANT: Do this BEFORE authenticate() to prevent any chance of login
        imported_user = User.objects.filter(email=email, is_imported_from_memberful=True).first()
        if imported_user and not imported_user.has_usable_password():
            # Automatically send password reset email for imported users
            uid = urlsafe_base64_encode(force_bytes(imported_user.pk))
            token = PasswordResetTokenGenerator().make_token(imported_user)
            reset_url = f"{settings.REACT_BASE_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

            try:
                email_events.send_imported_user_welcome(
                    user_id=imported_user.id,
                    to_email=imported_user.email,
                    reset_url=reset_url
                )
            except Exception:
                logger.exception(f"Failed to send welcome email to imported user {email}")

            return Response({
                'error': 'imported_user_welcome',
                'message': 'Welcome to the new EERIECAST! We\'ve sent you an email to set up your password.',
                'email': email
            }, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(email=email, password=password)
        if not user:
            return Response({
                'error': 'invalid_credentials',
                'message': 'Invalid email or password. Please try again.'
            }, status=status.HTTP_400_BAD_REQUEST)
        token, _ = Token.objects.get_or_create(user=user)
        response_data = {**UserSerializer(user, context={'request': request}).data, 'token': token.key}
        return Response({'user': response_data}, status=200)

    @action(detail=False, methods=['post', 'patch'], url_path='me/update-user', url_name='update-user')
    def update_user(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        if not user:
            return Response({'detail': 'Authentication required'}, status=401)
        if request.data.get('email') is not None:
            return Response(
                {'email': ['Use the email change flow to update your email address.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        return Response({'status': 'success', 'detail': 'Password changed successfully'}, status=200)
