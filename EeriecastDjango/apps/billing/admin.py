from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(ModelAdmin):
    list_display = (
        'id', 'user', 'stripe_subscription_id', 'status', 'is_active',
        'plan_nickname', 'card_brand', 'card_last4', 'current_period_end', 'cancel_at_period_end', 'updated_at'
    )
    list_filter = ('status', 'cancel_at_period_end', 'card_brand')
    search_fields = ('stripe_subscription_id', 'stripe_customer_id', 'user__email', 'user__username', 'card_last4')
    readonly_fields = ('created_at', 'updated_at')

    def is_active(self, obj: Subscription):
        return obj.is_active
    is_active.boolean = True
