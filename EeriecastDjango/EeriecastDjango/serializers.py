from django.contrib.auth import get_user_model, authenticate
from rest_framework import serializers
from apps.podcasts.models import Podcast
from apps.episodes.models import Episode
from apps.creators.models import Creator
from apps.categories.models import Category
from apps.library.models import Favorite, Following, ListeningHistory
from apps.episodes.serializers import EpisodeSerializer
from apps.categories.serializers import CategorySerializer
from apps.creators.serializers import CreatorSerializer
from rest_framework.exceptions import ValidationError

# IMPORTANT BECAUSE WE USE A CUSTOM USER
User = get_user_model()


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()  # Changed from username to email to match blueprint
    password = serializers.CharField()

    def validate(self, data):
        email = data.get('email')  # Changed from username to email
        password = data.get('password')

        if email is None:
            raise ValidationError({"email": ['Please fill out all fields']})
        if password is None:
            raise ValidationError({"password": ['Please fill out all fields']})

        try:
            user = authenticate(email=email, password=password)  # Changed to email auth
        except User.DoesNotExist as e:
            raise ValidationError({'non_field_errors': ['Invalid Login']})

        if user:
            return user
        else:
            raise ValidationError({'non_field_errors': ['Invalid Login']})


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'avatar', 'bio', 'is_premium', 'stripe_customer_id', 'minutes_listened',
            'subscription_expires', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


# Eeriecast serializers using the apps structure


class PodcastSerializer(serializers.ModelSerializer):
    creator = CreatorSerializer(read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    episodes = EpisodeSerializer(many=True, read_only=True)

    class Meta:
        model = Podcast
        fields = '__all__'


class PodcastListSerializer(serializers.ModelSerializer):
    creator = CreatorSerializer(read_only=True)
    categories = CategorySerializer(many=True, read_only=True)

    class Meta:
        model = Podcast
        exclude = ['description']


# New: Episode serializer variant that nests podcast details instead of a FK
class EpisodeWithPodcastSerializer(EpisodeSerializer):
    # Replace FK with nested podcast details (no episodes to avoid recursion)
    podcast = PodcastListSerializer(read_only=True)

    class Meta(EpisodeSerializer.Meta):
        pass


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = '__all__'
        read_only_fields = ['user']


class FollowingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Following
        fields = '__all__'
        read_only_fields = ['user']


class ListeningHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ListeningHistory
        fields = '__all__'
        read_only_fields = ['user']
