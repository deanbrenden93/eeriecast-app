import stripe
from django.conf import settings
from django.contrib.auth import get_user_model

def get_or_create_stripe_customer(user):
    """
    Ensures a User has a stripe_customer_id.
    Creates a new Customer in Stripe if one does not exist.
    """
    if user.stripe_customer_id:
        # Optionally verify it still exists in Stripe
        return user.stripe_customer_id
    
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    # Check if a customer with this email already exists in Stripe to avoid duplicates
    customers = stripe.Customer.list(email=user.email, limit=1).data
    if customers:
        customer_id = customers[0].id
    else:
        customer = stripe.Customer.create(
            email=user.email,
            name=f"{user.first_name} {user.last_name}".strip() or user.username,
            metadata={"user_id": user.id}
        )
        customer_id = customer.id
    
    user.stripe_customer_id = customer_id
    user.save(update_fields=["stripe_customer_id"])
    return customer_id
