from rest_framework import serializers
from django.contrib.auth import authenticate
from django.conf import settings
from .models import User

class UserSerializer(serializers.ModelSerializer):
    shop_discount_code = serializers.SerializerMethodField()
    is_on_legacy_trial = serializers.SerializerMethodField()
    legacy_trial_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                 'avatar', 'bio', 'is_premium', 'is_imported_from_memberful', 'memberful_plan_type',
                 'stripe_customer_id', 'minutes_listened',
                 'subscription_expires', 'date_of_birth', 'allow_mature_content',
                 'onboarding_completed', 'date_joined', 'created_at', 'shop_discount_code',
                 'is_legacy_free_trial', 'free_trial_ends', 'is_on_legacy_trial', 'legacy_trial_days_remaining']
        read_only_fields = ['id', 'date_joined', 'created_at', 'is_imported_from_memberful', 'memberful_plan_type',
                           'is_legacy_free_trial', 'free_trial_ends', 'is_on_legacy_trial', 'legacy_trial_days_remaining']

    def get_shop_discount_code(self, obj):
        request = self.context.get('request')
        # Only provide the code to the user themselves if they are a premium member
        if request and request.user.is_authenticated and request.user.id == obj.id:
            if obj.is_premium_member():
                return getattr(settings, 'SHOPIFY_DISCOUNT_CODE', None)
        return None

    def get_is_on_legacy_trial(self, obj):
        return obj.is_on_legacy_trial()

    def get_legacy_trial_days_remaining(self, obj):
        return obj.legacy_trial_days_remaining()

# Added lightweight list serializer used by UserViewSet list endpoint
class SimpleUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate_email(self, value):
        if value:
            return value.lower().strip()
        return value

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'date_of_birth']

    def validate_email(self, value):
        email = value.lower().strip()
        user = User.objects.filter(email=email).first()
        if user:
            # Allow registration if it's an imported user without a password
            if user.is_imported_from_memberful and not user.has_usable_password():
                return email
            raise serializers.ValidationError("This email is already in use. Please log in or use a different email.")
        return email

    def create(self, validated_data):
        password = validated_data.pop('password')
        email = validated_data.get('email')
        
        # Check if user already exists and is imported from memberful without a password
        user = User.objects.filter(email=email, is_imported_from_memberful=True).first()
        if user and not user.has_usable_password():
            # Update existing user
            for attr, value in validated_data.items():
                if attr != 'email': # email is already set and used for lookup
                    setattr(user, attr, value)
            user.set_password(password)
            user.save()
            return user

        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user
