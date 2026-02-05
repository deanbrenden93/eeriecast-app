from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status, viewsets

import stripe
from datetime import datetime

from .models import Subscription
from .serializers import SubscriptionSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_status(request):
    user = request.user
    subs = Subscription.objects.filter(user=user).order_by("-created_at")
    active = None
    for s in subs:
        if s.is_active:
            active = s
            break
    data = {
        # Compute using the new method to reflect live subscription state
        "is_premium": bool(getattr(user, "is_premium_member", lambda: getattr(user, "is_premium", False))()),
        "subscription_expires": getattr(user, "subscription_expires", None),
        "active_subscription": SubscriptionSerializer(active).data if active else None,
        "all_subscriptions": SubscriptionSerializer(subs, many=True).data,
    }
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upsert_subscription(request):
    """
    Minimal upsert endpoint to record/update a Stripe subscription for a user.
    Accepts payload with at minimum: stripe_subscription_id and status.
    Optional: stripe_customer_id, plan_id, plan_nickname, cancel_at_period_end,
              current_period_start, current_period_end, canceled_at, user_id (admin only).
    """
    payload = request.data

    # Determine the user to tie this subscription to
    target_user = request.user
    if "user_id" in payload:
        # Only admins can set user_id on behalf of others
        if request.user.is_staff:
            User = get_user_model()
            try:
                target_user = User.objects.get(pk=payload.get("user_id"))
            except User.DoesNotExist:
                return Response({"detail": "user_id not found"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"detail": "user_id is admin-only"}, status=status.HTTP_403_FORBIDDEN)

    stripe_subscription_id = payload.get("stripe_subscription_id")
    if not stripe_subscription_id:
        return Response({"detail": "stripe_subscription_id is required"}, status=status.HTTP_400_BAD_REQUEST)

    sub, _created = Subscription.objects.get_or_create(
        stripe_subscription_id=stripe_subscription_id,
        defaults={"user": target_user, "status": payload.get("status", "incomplete")},
    )

    # If this record exists but belongs to another user, prevent accidental reassignment unless admin
    if sub.user_id != target_user.id and not request.user.is_staff:
        return Response({"detail": "subscription belongs to another user"}, status=status.HTTP_403_FORBIDDEN)

    # Update fields
    sub.user = target_user
    sub.status = payload.get("status", sub.status)
    sub.stripe_customer_id = payload.get("stripe_customer_id", sub.stripe_customer_id)
    sub.plan_id = payload.get("plan_id", sub.plan_id)
    sub.plan_nickname = payload.get("plan_nickname", sub.plan_nickname)
    sub.cancel_at_period_end = bool(payload.get("cancel_at_period_end", sub.cancel_at_period_end))

    # Parse datetime fields if provided (accept ISO8601 strings)
    for field in ["current_period_start", "current_period_end", "canceled_at"]:
        val = payload.get(field)
        if val:
            parsed = parse_datetime(val) if isinstance(val, str) else val
            setattr(sub, field, parsed)

    sub.save()

    return Response(SubscriptionSerializer(sub).data)


class SubscriptionViewSet(viewsets.GenericViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="checkout-success")
    def checkout_success(self, request):
        """
        Handle Stripe Checkout success for a single subscription type.
        Expects a query param `session_id`.
        Retrieves the Stripe Checkout Session and underlying Subscription,
        then upserts a Subscription record for the authenticated user.
        """
        session_id = request.query_params.get("session_id")
        if not session_id:
            return Response({"detail": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not getattr(settings, "STRIPE_SECRET_KEY", None):
            return Response({"detail": "Stripe not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            session = stripe.checkout.Session.retrieve(session_id)
        except Exception as e:
            return Response({"detail": f"Unable to retrieve session: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        # We only support subscription mode for this app
        if getattr(session, "mode", None) != "subscription" or not getattr(session, "subscription", None):
            return Response({"detail": "Session is not a subscription checkout"}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve the Stripe subscription
        try:
            stripe_sub = stripe.Subscription.retrieve(session.subscription)
        except Exception as e:
            return Response({"detail": f"Unable to retrieve subscription: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user

        # Extract plan info (single plan expected)
        plan_id = None
        plan_nickname = None
        try:
            if stripe_sub and stripe_sub.get("items") and stripe_sub["items"]["data"]:
                price = stripe_sub["items"]["data"][0].get("price")
                if price:
                    plan_id = price.get("id")
                    plan_nickname = price.get("nickname")
        except Exception:
            pass

        # Timestamps (Stripe returns unix epoch seconds)
        def ts_to_dt(ts):
            try:
                return datetime.fromtimestamp(ts, tz=timezone.utc) if ts else None
            except Exception:
                return None

        current_period_start = ts_to_dt(stripe_sub.get("current_period_start"))
        current_period_end = ts_to_dt(stripe_sub.get("current_period_end"))
        canceled_at = ts_to_dt(stripe_sub.get("canceled_at"))

        # Upsert our local Subscription by Stripe subscription ID
        sub, _created = Subscription.objects.get_or_create(
            stripe_subscription_id=stripe_sub.get("id"),
            defaults={"user": user, "status": stripe_sub.get("status", "incomplete")},
        )

        # Update fields based on Stripe
        sub.user = user
        sub.stripe_customer_id = session.get("customer") or stripe_sub.get("customer")
        sub.status = stripe_sub.get("status", sub.status)
        sub.cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end", False))
        sub.plan_id = plan_id or sub.plan_id
        sub.plan_nickname = plan_nickname or sub.plan_nickname
        sub.current_period_start = current_period_start
        sub.current_period_end = current_period_end
        sub.canceled_at = canceled_at
        sub.save()

        return Response(SubscriptionSerializer(sub).data, status=status.HTTP_200_OK)
