from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_premium', 'minutes_listened', 'is_staff', 'date_joined')
    list_filter = ('is_premium', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Eeriecast Profile', {
            'fields': ('avatar', 'bio', 'is_premium', 'minutes_listened', 'subscription_expires')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Eeriecast Profile', {
            'fields': ('email', 'avatar', 'bio', 'is_premium')
        }),
    )
