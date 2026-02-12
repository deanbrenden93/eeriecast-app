from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework import status, viewsets

import stripe
import logging
from datetime import datetime

from .models import Subscription
from .serializers import SubscriptionSerializer
from .utils import get_or_create_stripe_customer

logger = logging.getLogger(__name__)


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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_checkout_session(request):
    """
    Create a Stripe Checkout Session for the monthly subscription with a 7-day trial.
    """
    user = request.user
    
    if user.is_premium_member():
        return Response({"detail": "You already have an active subscription."}, status=status.HTTP_400_BAD_REQUEST)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    if not settings.STRIPE_MONTHLY_PRICE_ID:
        return Response({"detail": "Stripe price ID not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    customer_id = get_or_create_stripe_customer(user)
    
    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            line_items=[
                {
                    'price': settings.STRIPE_MONTHLY_PRICE_ID,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            subscription_data={
                'trial_period_days': settings.STRIPE_TRIAL_DAYS,
            },
            success_url=settings.REACT_BASE_URL + '/premium?success=true&session_id={CHECKOUT_SESSION_ID}',
            cancel_url=settings.REACT_BASE_URL + '/premium?canceled=true',
            allow_promotion_codes=True,
        )
        return Response({'url': checkout_session.url})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_trial_custom(request):
    """
    Start a 7-day trial using a Stripe token from the frontend.
    Attaches the token to the customer and starts the subscription.
    """
    user = request.user
    data = request.data
    
    if user.is_premium_member():
        return Response({"detail": "You already have an active subscription."}, status=status.HTTP_400_BAD_REQUEST)
    
    logger.info(f"Custom trial signup started for user {user.email}")
    
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    stripe_token = data.get('stripeToken')
    
    if not stripe_token:
        logger.warning(f"Missing stripeToken in request for user {user.email}")
        return Response({"detail": "Missing payment token"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # 1. Get or create customer
        customer_id = get_or_create_stripe_customer(user)
        logger.info(f"Stripe customer ID: {customer_id}")
        
        # 2. Attach token to customer (set as default source)
        logger.info(f"Attaching token {stripe_token} to customer {customer_id}")
        stripe.Customer.modify(customer_id, source=stripe_token)
        
        # 3. Create subscription
        logger.info(f"Creating subscription with price {settings.STRIPE_MONTHLY_PRICE_ID} and {settings.STRIPE_TRIAL_DAYS} days trial")
        stripe_sub = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": settings.STRIPE_MONTHLY_PRICE_ID}],
            trial_period_days=settings.STRIPE_TRIAL_DAYS,
        )
        logger.info(f"Stripe subscription created: {stripe_sub.id}")
        
        # 5. Sync locally
        handle_subscription_change(stripe_sub)
        logger.info(f"Local subscription sync completed for {stripe_sub.id}")
        
        sub = Subscription.objects.get(stripe_subscription_id=stripe_sub.id)
        return Response(SubscriptionSerializer(sub).data)
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error during custom trial signup: {str(e)}")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Unexpected error during custom trial signup: {str(e)}")
        return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_portal_session(request):
    """
    Create a Stripe Customer Portal session for managing subscriptions.
    """
    user = request.user
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    if not user.stripe_customer_id:
        return Response({"detail": "No Stripe customer found"}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=settings.REACT_BASE_URL + '/profile',
        )
        return Response({'url': portal_session.url})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def stripe_webhook(request):
    """
    Handle Stripe webhooks to keep local subscription data in sync.
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

    if not endpoint_secret:
        return Response({"detail": "Webhook secret not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        return Response(status=status.HTTP_400_BAD_REQUEST)
    except stripe.error.SignatureVerificationError:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    # Handle the event
    if event['type'] in [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
    ]:
        stripe_sub = event['data']['object']
        handle_subscription_change(stripe_sub)

    return Response(status=status.HTTP_200_OK)


def handle_subscription_change(stripe_sub):
    """
    Helper to sync a Stripe subscription object to our local database.
    """
    stripe_subscription_id = stripe_sub.get("id")
    customer_id = stripe_sub.get("customer")
    status_str = stripe_sub.get("status")
    
    logger.info(f"Handling subscription change: {stripe_subscription_id} (Customer: {customer_id}, Status: {status_str})")
    
    # Try to find the user
    User = get_user_model()
    user = User.objects.filter(stripe_customer_id=customer_id).first()
    
    if not user:
        logger.info(f"User not found by stripe_customer_id {customer_id}, searching by email...")
        # Fallback to searching by email if customer ID match fails
        try:
            customer = stripe.Customer.retrieve(customer_id)
            user = User.objects.filter(email=customer.email).first()
            if user and not user.stripe_customer_id:
                logger.info(f"Found user by email {customer.email}, updating stripe_customer_id")
                user.stripe_customer_id = customer_id
                user.save(update_fields=["stripe_customer_id"])
        except Exception as e:
            logger.error(f"Error retrieving customer from Stripe: {str(e)}")
            pass

    if not user:
        logger.warning(f"Could not find user for customer {customer_id}")
        return

    logger.info(f"Syncing subscription for user {user.email}")

    # Upsert the subscription record
    sub, created = Subscription.objects.get_or_create(
        stripe_subscription_id=stripe_subscription_id,
        defaults={"user": user, "status": status_str or "incomplete"},
    )
    
    if created:
        logger.info(f"Created new local subscription record for {stripe_subscription_id}")
    else:
        logger.info(f"Updating existing local subscription record for {stripe_subscription_id}")
    
    # Update fields
    sub.user = user
    sub.status = stripe_sub.get("status", sub.status)
    sub.stripe_customer_id = customer_id
    sub.cancel_at_period_end = bool(stripe_sub.get("cancel_at_period_end", False))
    
    # Extract plan
    try:
        if stripe_sub.get("items") and stripe_sub["items"]["data"]:
            price = stripe_sub["items"]["data"][0].get("price")
            if price:
                sub.plan_id = price.get("id")
                sub.plan_nickname = price.get("nickname")
    except Exception:
        pass
            
    # Timestamps
    def ts_to_dt(ts):
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc) if ts else None
        except Exception:
            return None

    sub.current_period_start = ts_to_dt(stripe_sub.get("current_period_start"))
    sub.current_period_end = ts_to_dt(stripe_sub.get("current_period_end"))
    sub.canceled_at = ts_to_dt(stripe_sub.get("canceled_at"))
    
    sub.save()
