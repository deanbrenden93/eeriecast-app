from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'email_verified', 'is_premium', 'is_imported_from_memberful', 'minutes_listened', 'is_staff', 'date_joined')
    list_filter = ('email_verified', 'is_premium', 'is_imported_from_memberful', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'stripe_customer_id')
    ordering = ('-date_joined',)

    readonly_fields = ('email_verified_at',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Eeriecast Profile', {
            'fields': ('avatar', 'bio', 'email_verified', 'email_verified_at', 'is_premium', 'is_imported_from_memberful', 'stripe_customer_id', 'minutes_listened', 'subscription_expires')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Eeriecast Profile', {
            'fields': ('email', 'avatar', 'bio', 'email_verified', 'is_premium', 'is_imported_from_memberful')
        }),
    )
