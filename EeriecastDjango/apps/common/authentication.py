"""
Lenient JWT authentication that treats invalid/expired tokens as anonymous
requests instead of raising 401.

This fixes the well-known DRF + SimpleJWT issue where sending an expired JWT
to a public (AllowAny) endpoint returns 401 instead of falling through to
anonymous access.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class LenientJWTAuthentication(JWTAuthentication):
    """
    Same as JWTAuthentication but returns None (anonymous) instead of
    raising AuthenticationFailed when the token is invalid or expired.

    This means:
    - Valid token → authenticated user (as normal)
    - Invalid/expired token → treated as anonymous request
    - No token → treated as anonymous request (as normal)

    Endpoints that actually require authentication still enforce it via
    their permission classes (IsAuthenticated), which will return 403.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            # Token is expired/invalid — treat as anonymous
            return None
