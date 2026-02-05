# users/admin.py
import datetime

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from .models import CustomUser
from users.forms import *
from unfold.admin import ModelAdmin


class CustomUserAdmin(UserAdmin, ModelAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

    list_display = ['username', 'email_address', 'id', 'first_name', 'last_name', 'formatted_date_joined']
    ordering = ['-id',]
    search_fields = ('username', 'email_address', 'first_name', 'last_name')

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


admin.site.register(CustomUser, CustomUserAdmin)
