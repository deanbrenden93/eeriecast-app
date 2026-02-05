from rest_framework import serializers
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'user', 'stripe_subscription_id', 'stripe_customer_id',
            'plan_id', 'plan_nickname', 'status', 'cancel_at_period_end',
            'current_period_start', 'current_period_end', 'canceled_at',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

