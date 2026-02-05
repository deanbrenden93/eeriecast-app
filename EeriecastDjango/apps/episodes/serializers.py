from rest_framework import serializers
from .models import Episode, Comment
from apps.authentication.serializers import SimpleUserSerializer

class CommentSerializer(serializers.ModelSerializer):
    user = SimpleUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'user', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class EpisodeSerializer(serializers.ModelSerializer):
    # Compute audio_url dynamically; do not expose ad_* in responses
    audio_url = serializers.SerializerMethodField(read_only=True)
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Episode
        fields = [
            'id', 'podcast', 'title', 'slug', 'description', 'audio_url',
            'duration', 'episode_number', 'season_number', 'is_premium',
            'transcript', 'cover_image', 'play_count', 'published_at', 'created_at',
            'comments',
            # accept these on write but keep them out of responses
            'ad_supported_audio_url', 'ad_free_audio_url',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'ad_supported_audio_url': {'write_only': True, 'required': False, 'allow_null': True, 'allow_blank': True},
            'ad_free_audio_url': {'write_only': True, 'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def get_audio_url(self, obj: Episode) -> str:
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_premium = False
        if user is not None and getattr(user, 'is_authenticated', False):
            # Prefer the live method if present, else fall back to boolean flag
            is_premium = bool(getattr(user, 'is_premium_member', lambda: getattr(user, 'is_premium', False))())
        # Prefer ad-free if premium and available
        if is_premium and getattr(obj, 'ad_free_audio_url', None):
            return obj.ad_free_audio_url
        # Otherwise prefer ad-supported if available
        if getattr(obj, 'ad_supported_audio_url', None):
            return obj.ad_supported_audio_url
