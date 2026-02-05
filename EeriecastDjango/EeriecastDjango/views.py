import json
import os
import uuid
import django.views.generic
from django.contrib.auth import get_user_model
from django.contrib.staticfiles import finders
from django.core.files.base import ContentFile
from django.core.mail import send_mail, EmailMessage
from django.db.models import Q
from django.http import HttpResponse, StreamingHttpResponse
from django.template.loader import get_template
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from . import serializers as app_serializers
from apps.common.utils import strip_non_model_fields
from rest_framework import viewsets, permissions

User = get_user_model()

class CSVUploadViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request):
        # grab the uploaded file; the key should be "file"
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'no csv file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # read bytes, decode to string, split into lines
        decoded = csv_file.read().decode('utf-8').splitlines()

        # use csv.DictReader so each row is a dict keyed by header
        import csv
        reader = csv.DictReader(decoded)
        for row in reader:
            # placeholder: process each row and save to your models
            pass

        return Response({'status': 'csv processed successfully'}, status=status.HTTP_200_OK)
