from rest_framework import serializers
from .models import Episode


def _resolve_is_premium(context: dict) -> bool:
    """Return whether the current request's user is premium, computing it
    at most once per serialization pass.

    ``Episode`` serializers are used to render lists that can contain
    dozens of episodes per response. Asking ``user.is_premium_member()``
    on every row used to trigger one Subscription DB roundtrip per
    episode for any user whose cached ``is_premium`` flag was stale —
    classic N+1. Caching the answer on the shared DRF ``context`` dict
    collapses that back to a single check per request, regardless of
    how many episodes are being serialized or how many nested
    serializers reach in here.
    """
    if 'is_premium' in context:
        return bool(context['is_premium'])
    request = context.get('request')
    user = getattr(request, 'user', None)
    is_premium = False
    if user is not None and getattr(user, 'is_authenticated', False):
        is_premium = bool(getattr(user, 'is_premium_member', lambda: getattr(user, 'is_premium', False))())
    context['is_premium'] = is_premium
    return is_premium


class EpisodeSerializer(serializers.ModelSerializer):
    # Compute audio_url and duration dynamically; do not expose ad_* in
    # responses. ``duration`` is overridden as a method field (rather than
    # surfacing the raw DB column) so premium users see the ad-free
    # runtime — episode cards across the app previously showed the
    # longer ad-supported runtime to every user because that was the
    # only value stored on ``Episode.duration``.
    audio_url = serializers.SerializerMethodField(read_only=True)
    duration = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Episode
        fields = [
            'id', 'podcast', 'title', 'slug', 'description', 'audio_url',
            'duration', 'episode_number', 'season_number', 'is_premium',
            'transcript', 'cover_image', 'play_count', 'published_at', 'created_at',
            # accept these on write but keep them out of responses
            'ad_supported_audio_url', 'ad_free_audio_url',
        ]
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'ad_supported_audio_url': {'write_only': True, 'required': False, 'allow_null': True, 'allow_blank': True},
            'ad_free_audio_url': {'write_only': True, 'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def get_audio_url(self, obj: Episode) -> str:
        is_premium = _resolve_is_premium(self.context)
        return obj.get_computed_audio_url(is_premium=is_premium)

    def get_duration(self, obj: Episode) -> int:
        is_premium = _resolve_is_premium(self.context)
        return obj.get_computed_duration(is_premium=is_premium)
