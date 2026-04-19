from django import forms
from django.contrib.auth.forms import UserChangeForm, ReadOnlyPasswordHashField
from django.utils.safestring import mark_safe
from .models import User


class CustomUserChangeForm(UserChangeForm):
    password = ReadOnlyPasswordHashField(
        label="Password",
        help_text=mark_safe(
            'Raw passwords are not stored, so there is no way to see this user\'s password, '
            'but you can change the password using <a href="../password/" style="color: rgb(239, 68, 68);">this form</a>.'
        ),
    )

    class Meta:
        model = User
        fields = '__all__'
