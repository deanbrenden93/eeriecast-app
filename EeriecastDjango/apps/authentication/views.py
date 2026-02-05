from rest_framework import status, generics, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from rest_framework.permissions import AllowAny, IsAuthenticated
from apps.common.utils import strip_non_model_fields
from .models import User
from .serializers import (
    UserSerializer,
    SimpleUserSerializer,
    LoginSerializer,
    RegisterSerializer,
)

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
        user = authenticate(email=email, password=password)

        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': UserSerializer(user).data
            })
        return Response({'error': 'Invalid credentials'}, status=400)
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
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

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

# ---------------------------
# Migrated UserViewSet
# ---------------------------
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-id').exclude(is_superuser=True)
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
        return Response({'user': {
            **UserSerializer(user, context={'request': request}).data,
            'token': token.key
        }}, status=201)

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        self.get_serializer(user, data=request.data, partial=True).is_valid(raise_exception=True)
        user_data = strip_non_model_fields(request.data, User)
        for key, value in user_data.items():
            setattr(user, key, value)
        user.save()
        return Response(UserSerializer(user, context={'request': request}).data, status=200)

    @action(detail=False, methods=['post'], url_path='authenticate', url_name='authenticate')
    def authenticate(self, request, *args, **kwargs):
        validated_user = LoginSerializer(data=request.data)
        validated_user.is_valid(raise_exception=True)
        user = authenticate(email=validated_user.validated_data['email'], password=validated_user.validated_data['password'])
        if not user:
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
        new_password = request.data.get('password')
        if not new_password:
            return Response({'password': ['This field is required.']}, status=400)
        request.user.set_password(new_password)
        request.user.save()
        return Response(status=200)
