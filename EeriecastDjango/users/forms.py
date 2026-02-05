from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.contrib.postgres.forms import SimpleArrayField

from users.models import CustomUser
from django.contrib.auth.forms import (
    AdminPasswordChangeForm, UserChangeForm, UserCreationForm,
)

# Use django-unfold widgets for proper rendering in admin
try:
    from unfold.contrib.forms.widgets import PasswordInput as UnfoldPasswordInput
except Exception:  # fallback if unfold widgets are unavailable at runtime
    from django.forms import PasswordInput as UnfoldPasswordInput


class CustomUserChangeForm(UserChangeForm):

    class Meta:
        model = CustomUser
        fields = '__all__'


class CustomUserCreationForm(UserCreationForm):
    # Ensure password fields use Unfold's PasswordInput for proper rendering
    password1 = forms.CharField(
        label="Password",
        strip=False,
        widget=UnfoldPasswordInput(render_value=False),
        help_text=UserCreationForm.base_fields["password1"].help_text,
    )
    password2 = forms.CharField(
        label="Password confirmation",
        widget=UnfoldPasswordInput(render_value=False),
        strip=False,
        help_text=UserCreationForm.base_fields["password2"].help_text,
    )

    class Meta:
        model = CustomUser
        fields = ("username", "first_name", "last_name", "email_address")
