from rest_framework import serializers
from .models import Favorite, Following, ListeningHistory, PlaybackEvent, Playlist, Notification
from apps.episodes.models import Episode
from EeriecastDjango.serializers import EpisodeSerializer, EpisodeWithPodcastSerializer  # use the full episode serializer + nested podcast

class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = '__all__'

class FavoriteWithEpisodeSerializer(serializers.ModelSerializer):
    # Include full episode detail for episode favorites
    episode = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Favorite
        # keep core fields for backward-compat; add nested episode details
        fields = ('id', 'user', 'content_type', 'object_id', 'created_at', 'episode')
        read_only_fields = fields

    def get_episode(self, obj: Favorite):
        # Use pre-fetched map when available to avoid extra queries
        episode_map = self.context.get('episode_map') or {}
        ep = episode_map.get(obj.object_id)
        if ep is None and obj.content_type and obj.content_type.model == 'episode':
            # Fallback single fetch if not preloaded
            ep = Episode.objects.filter(pk=obj.object_id).first()
        if ep is None:
            return None
        return EpisodeSerializer(ep, context=self.context).data

class FavoriteCreateSerializer(serializers.Serializer):
    content_type = serializers.ChoiceField(choices=[('podcast', 'podcast'), ('episode', 'episode')])
    content_id = serializers.IntegerField(min_value=1)

class PodcastFollowingCreateSerializer(serializers.Serializer):
    podcast_id = serializers.IntegerField(min_value=1)

class FollowingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Following
        fields = '__all__'

class EpisodeBriefSerializer(serializers.ModelSerializer):
    # Only return computed audio_url, not ad_* URLs
    audio_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Episode
        fields = (
            'id', 'podcast', 'title', 'slug', 'cover_image', 'duration',
            'audio_url', 'published_at'
        )

    def get_audio_url(self, obj: Episode) -> str:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_premium = False
        if user is not None and getattr(user, 'is_authenticated', False):
            is_premium = bool(getattr(user, 'is_premium_member', lambda: getattr(user, 'is_premium', False))())
        if is_premium and getattr(obj, 'ad_free_audio_url', None):
            return obj.ad_free_audio_url
        if getattr(obj, 'ad_supported_audio_url', None):
            return obj.ad_supported_audio_url
        return getattr(obj, 'audio_url', None)

class ListeningHistorySerializer(serializers.ModelSerializer):
    # Remove redundant source kwarg; computed by model property of the same name
    percent_complete = serializers.FloatField(read_only=True)
    episode_detail = EpisodeWithPodcastSerializer(source='episode', read_only=True)

    class Meta:
        model = ListeningHistory
        fields = '__all__'

class PlaybackEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlaybackEvent
        fields = '__all__'


class PlaylistSerializer(serializers.ModelSerializer):
    # Allow write using episode IDs; read returns IDs by default
    episodes = serializers.PrimaryKeyRelatedField(many=True, queryset=Episode.objects.all(), required=False)
    # Set user automatically from the request
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Playlist
        fields = ('id', 'user', 'name', 'episodes', 'approximate_length_minutes', 'created_at', 'updated_at')
        read_only_fields = ('approximate_length_minutes', 'created_at', 'updated_at')


class NotificationSerializer(serializers.ModelSerializer):
    # User is inferred from the request by default
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ('created_at',)
