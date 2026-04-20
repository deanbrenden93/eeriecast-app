from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.conf import settings
from django.utils.safestring import mark_safe
from unfold.admin import ModelAdmin
from .models import User
from .forms import CustomUserChangeForm

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = CustomUserChangeForm
    list_display = ('email', 'username', 'first_name', 'last_name', 'email_verified', 'is_premium', 'is_imported_from_memberful', 'minutes_listened', 'is_staff', 'date_joined')
    list_filter = ('email_verified', 'is_premium', 'is_imported_from_memberful', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'stripe_customer_id')
    ordering = ('-date_joined',)

    readonly_fields = ('email_verified_at', 'get_shop_discount_code')
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Eeriecast Profile', {
            'fields': (
                'avatar', 'bio', 'email_verified', 'email_verified_at', 
                'is_premium', 'is_imported_from_memberful', 
                'is_legacy_free_trial', 'free_trial_ends', 
                'stripe_customer_id', 'minutes_listened', 
                'subscription_expires', 'get_shop_discount_code'
            )
        }),
    )
    
    def get_shop_discount_code(self, obj):
        code = getattr(settings, 'SHOPIFY_DISCOUNT_CODE', 'Not Set')
        help_text = "This is the discount code that will automatically be applied to a user."
        return mark_safe(f"{code}<p style='color: #666; font-size: 0.8em; margin-top: 5px;'>{help_text}</p>")
    get_shop_discount_code.short_description = 'Shopify Discount Code'

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Eeriecast Profile', {
            'fields': ('email', 'avatar', 'bio', 'email_verified', 'is_premium', 'is_imported_from_memberful')
        }),
    )
