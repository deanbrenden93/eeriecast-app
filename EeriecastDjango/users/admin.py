# users/admin.py
import datetime

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from .models import CustomUser
from users.forms import *
from unfold.admin import ModelAdmin


class CustomUserAdmin(UserAdmin, ModelAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

    list_display = ['username', 'email_address', 'id', 'first_name', 'last_name', 'formatted_date_joined']
    ordering = ['-id',]
    search_fields = ('username', 'email_address', 'first_name', 'last_name')
    readonly_fields = ('password', 'date_joined', 'last_login')

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            # these match up with the fields on the model
            'fields': ('username', 'first_name', 'last_name', 'email_address', 'password1', 'password2',),
        }),
    )

    fieldsets = (
        ('User Information', {
            'classes': ('wide',),
            # these match up with the fields on the model
            'fields': (
                'username',
                'first_name',
                'last_name',
                'phone_number',
                'email_address',
                'address_line1',
                'address_line2',

            ),
        }),
        ('Password', {
            'classes': ('wide',),
            'fields': ('password',),
        }),
        ('Roles', {
            'classes': ('wide',),
            'fields': ('is_staff', 'is_active', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Activity', {
            'classes': ('wide',),
            'fields': ('date_joined', 'last_login'),
        })
    )

    def formatted_date_joined(self, instance):
        # date_joined is in UTC, convert to EST
        return instance.date_joined - datetime.timedelta(hours=4)

    def password(self, obj):
        # Return the password field with properly formatted HTML link
        change_password_url = f"../../{obj.pk}/password/"
        return format_html(
            'Raw passwords are not stored, so there is no way to see this user\'s password, '
            'but you can change the password using <a href="{}">this form</a>.',
            change_password_url
        )
    password.short_description = "Password"


admin.site.register(CustomUser, CustomUserAdmin)
