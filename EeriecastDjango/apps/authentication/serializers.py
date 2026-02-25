from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                 'avatar', 'bio', 'is_premium', 'stripe_customer_id', 'minutes_listened',
                 'subscription_expires', 'created_at']
        read_only_fields = ['id', 'created_at']

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
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def validate_email(self, value):
        email = value.lower().strip()
        user = User.objects.filter(email=email).first()
        if user:
            # Allow registration if it's an imported user without a password
            if user.is_imported_from_memberful and not user.has_usable_password():
                return email
            raise serializers.ValidationError("A user with this email already exists.")
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
