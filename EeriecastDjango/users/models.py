import datetime
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.dispatch import receiver
from django.utils import timezone


class CustomUser(AbstractUser):
    # USERNAME_FIELD = 'email'
    # REQUIRED_FIELDS = []  # removes email from REQUIRED_FIELDS

    id = models.AutoField(primary_key=True)
    first_name = models.CharField(blank=False, null=False, max_length=255)
    last_name = models.CharField(blank=False, null=False, max_length=255)
    username = models.CharField(unique=True, max_length=256)
    email_address = models.EmailField(blank=False, null=False)
    phone_number = models.CharField(blank=True, null=True, max_length=256)
    address_line1 = models.CharField(blank=True, null=True, max_length=256)
    address_line2 = models.CharField(blank=True, null=True, max_length=256)

    def __str__(self):
        return f'{self.first_name} {self.last_name}'