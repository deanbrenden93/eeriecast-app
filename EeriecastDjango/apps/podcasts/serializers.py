from rest_framework import serializers
from .models import Podcast
from apps.episodes.models import Episode
from apps.creators.models import Creator
from apps.categories.models import Category
from apps.episodes.serializers import EpisodeSerializer


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class CreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Creator
        fields = '__all__'

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
    episodes = EpisodeSerializer(many=True, read_only=True)

    class Meta:
        model = Podcast
        exclude = ['description']
