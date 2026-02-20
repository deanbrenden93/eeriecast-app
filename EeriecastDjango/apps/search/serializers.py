from rest_framework import serializers
from apps.podcasts.models import Podcast
from apps.episodes.models import Episode
from apps.creators.models import Creator

class SearchPodcastSerializer(serializers.ModelSerializer):
    class Meta:
        model = Podcast
        fields = ['id', 'title', 'slug', 'description', 'cover_image', 'creator', 'category']

class SearchEpisodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Episode
        fields = ['id', 'title', 'slug', 'description', 'podcast', 'cover_image', 'duration', 'published_at']

class SearchCreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Creator
        fields = ['id', 'display_name', 'bio', 'avatar', 'is_verified']
