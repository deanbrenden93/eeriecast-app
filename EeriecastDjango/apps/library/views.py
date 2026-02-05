from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import Favorite, Following, ListeningHistory, PlaybackEvent, Playlist, Notification
from .serializers import FavoriteSerializer, FollowingSerializer, ListeningHistorySerializer, PlaybackEventSerializer, PlaylistSerializer, FavoriteCreateSerializer, PodcastFollowingCreateSerializer, NotificationSerializer
from rest_framework import viewsets
from apps.episodes.models import Episode
from django.db.models import Count
from apps.podcasts.models import Podcast
from apps.podcasts.serializers import PodcastListSerializer, PodcastSerializer  # include full podcast serializer
from EeriecastDjango.serializers import EpisodeSerializer  # full episode detail

class FavoriteListCreateView(generics.ListCreateAPIView):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user)

    def post(self, request, *args, **kwargs):
        # Ensure user is authenticated (permission class should enforce this, but we double-check)
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=403)

        input_serializer = FavoriteCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        content_type = input_serializer.validated_data['content_type']
        content_id = input_serializer.validated_data['content_id']

        ct_episode = ContentType.objects.get_for_model(Episode)

        created_favorites = []
        if content_type == 'episode':
            # Validate episode exists
            try:
                Episode.objects.only('id').get(pk=content_id)
            except Episode.DoesNotExist:
                return Response({'detail': 'Episode not found.'}, status=404)

            fav, _ = Favorite.objects.get_or_create(
                user=request.user,
                content_type=ct_episode,
                object_id=content_id,
            )
            created_favorites = [fav]
        else:  # content_type == 'podcast'
            episode_ids = list(Episode.objects.filter(podcast_id=content_id).values_list('id', flat=True))
            if not episode_ids:
                return Response({'detail': 'No episodes found for that podcast.'}, status=404)
            # Create favorites for all episodes under that podcast
            for eid in episode_ids:
                fav, _ = Favorite.objects.get_or_create(
                    user=request.user,
                    content_type=ct_episode,
                    object_id=eid,
                )
                created_favorites.append(fav)

        data = FavoriteSerializer(created_favorites, many=True).data
        return Response({'created': len(created_favorites), 'favorites': data}, status=201)

    def delete(self, request, *args, **kwargs):
        # Accept the same payload as POST to remove favorites
        if not request.user or not request.user.is_authenticated:
            return Response({'detail': 'Authentication required.'}, status=403)

        input_serializer = FavoriteCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        content_type = input_serializer.validated_data['content_type']
        content_id = input_serializer.validated_data['content_id']

        ct_episode = ContentType.objects.get_for_model(Episode)

        if content_type == 'episode':
            if not Episode.objects.filter(pk=content_id).exists():
                return Response({'detail': 'Episode not found.'}, status=404)
            deleted_count, _ = Favorite.objects.filter(
                user=request.user,
                content_type=ct_episode,
                object_id=content_id,
            ).delete()
            return Response({'deleted': deleted_count})
        else:  # content_type == 'podcast'
            episode_ids = list(Episode.objects.filter(podcast_id=content_id).values_list('id', flat=True))
            if not episode_ids:
                return Response({'detail': 'No episodes found for that podcast.'}, status=404)
            deleted_count, _ = Favorite.objects.filter(
                user=request.user,
                content_type=ct_episode,
                object_id__in=episode_ids,
            ).delete()
            return Response({'deleted': deleted_count})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def favorites_summary(request):
    """
    Return a normalized list of podcasts where the user has favorited at least one episode.
    Each entry includes:
      - podcast: full podcast detail
      - episodes: list of favorited episode details (full)
      - favorited_episode_count
      - total_episode_count
      - all_episodes_favorited (bool)
      - favorited_episode_ids (for convenience)
    Meta keys:
      - total_podcasts
      - total_favorited_episodes
    """
    user = request.user
    ct_episode = ContentType.objects.get_for_model(Episode)

    # All episode favorites for the user
    favorites_qs = (
        Favorite.objects.filter(user=user, content_type=ct_episode)
        .order_by('-created_at')
    )
    if not favorites_qs.exists():
        return Response({
            'results': [],
            'total_podcasts': 0,
            'total_favorited_episodes': 0,
        })

    fav_episode_ids = list(favorites_qs.values_list('object_id', flat=True))

    # Preload favorited episodes with their podcasts (to avoid N+1)
    episodes = (
        Episode.objects.filter(id__in=fav_episode_ids)
        .select_related('podcast')
    )

    # Group episodes by podcast
    podcast_episode_map = {}
    for ep in episodes:
        podcast_episode_map.setdefault(ep.podcast_id, []).append(ep)

    podcast_ids = list(podcast_episode_map.keys())

    # Preload podcasts
    podcasts = Podcast.objects.filter(id__in=podcast_ids).prefetch_related('categories', 'creator')
    podcast_map = {p.id: p for p in podcasts}

    # Determine total episode counts per podcast for all_episodes_favorited flag
    total_counts = (
        Episode.objects.filter(podcast_id__in=podcast_ids)
        .values('podcast_id')
        .annotate(total_count=Count('id'))
    )
    total_map = {row['podcast_id']: row['total_count'] for row in total_counts}

    results = []
    for pid, fav_eps in podcast_episode_map.items():
        podcast = podcast_map.get(pid)
        if not podcast:
            continue  # safety
        favorited_episode_count = len(fav_eps)
        total_episode_count = total_map.get(pid, favorited_episode_count)
        all_episodes_favorited = favorited_episode_count == total_episode_count and total_episode_count > 0
        # Serialize podcast and episodes
        serialized_podcast = PodcastSerializer(podcast, context={'request': request}).data
        serialized_episodes = [EpisodeSerializer(e, context={'request': request}).data for e in fav_eps]
        results.append({
            'podcast': serialized_podcast,
            'episodes': serialized_episodes,
            'favorited_episode_count': favorited_episode_count,
            'total_episode_count': total_episode_count,
            'all_episodes_favorited': all_episodes_favorited,
            'favorited_episode_ids': [e.id for e in fav_eps],
        })

    # Sort results optionally by favorited_episode_count desc then podcast id
    results.sort(key=lambda r: (-r['favorited_episode_count'], r['podcast']['id']))

    return Response({
        'results': results,
        'total_podcasts': len(results),
        'total_favorited_episodes': len(fav_episode_ids),
    })

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def remove_favorite(request, content_type, content_id):
    try:
        ct = ContentType.objects.get(model=content_type)
        favorite = Favorite.objects.get(
            user=request.user, 
            content_type=ct, 
            object_id=content_id
        )
        favorite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Favorite.DoesNotExist:
        return Response({'error': 'Favorite not found'}, status=404)

class FollowingListCreateView(generics.ListCreateAPIView):
    serializer_class = FollowingSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Following.objects.filter(user=self.request.user)

class ListeningHistoryListCreateView(generics.ListCreateAPIView):
    serializer_class = ListeningHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return ListeningHistory.objects.filter(user=self.request.user).select_related('episode', 'episode__podcast')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def update_progress(request, episode_id):
    try:
        progress = int(request.data.get('progress', 0) or 0)
        duration = int(request.data.get('duration', 0) or 0)
        playback_rate = request.data.get('playback_rate', 1.0) or 1.0
        source = (request.data.get('source') or '').strip()
        device_id = (request.data.get('device_id') or '').strip()
        event = (request.data.get('event') or '').strip()  # optional: play/pause/seek/heartbeat/complete
        client_time = request.data.get('client_time')  # optional ISO datetime

        history, created = ListeningHistory.objects.get_or_create(
            user=request.user,
            episode_id=episode_id,
            defaults={'progress': progress, 'duration': duration, 'playback_rate': playback_rate, 'source': source, 'device_id': device_id}
        )

        changed = False
        if not created:
            if progress and progress != history.progress:
                history.progress = progress
                changed = True
            if duration and duration != history.duration:
                history.duration = duration
                changed = True
            if playback_rate and playback_rate != history.playback_rate:
                history.playback_rate = playback_rate
                changed = True
            if source and source != history.source:
                history.source = source
                changed = True
            if device_id and device_id != history.device_id:
                history.device_id = device_id
                changed = True

        # Auto-complete if threshold reached (90%) or explicit event=complete
        threshold = 0.9
        if (duration > 0 and progress >= int(duration * threshold)) or event == 'complete':
            if not history.completed:
                history.completed = True
                history.completed_at = timezone.now()
                changed = True
        else:
            if history.completed:
                # If user scrubbed back significantly, mark not completed
                history.completed = False
                history.completed_at = None
                changed = True

        if changed:
            history.save()

        # Optional event logging
        if event:
            try:
                PlaybackEvent.objects.create(
                    user=request.user,
                    episode_id=episode_id,
                    event=event,
                    position=progress,
                    duration=duration,
                    playback_rate=playback_rate,
                    source=source,
                    device_id=device_id,
                    client_time=client_time if client_time else None,
                )
            except Exception:
                # Do not fail the progress update if event logging fails
                pass

        return Response(ListeningHistorySerializer(history).data)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def resume_latest(request):
    history = ListeningHistory.objects.filter(user=request.user).select_related('episode', 'episode__podcast').order_by('-last_played').first()
    if not history:
        return Response({'detail': 'No listening history found.'}, status=404)
    return Response(ListeningHistorySerializer(history).data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def resume_for_podcast(request, podcast_id):
    history = ListeningHistory.objects.filter(user=request.user, episode__podcast_id=podcast_id).select_related('episode', 'episode__podcast').order_by('-last_played').first()
    if not history:
        return Response({'detail': 'No listening history for this podcast.'}, status=404)
    return Response(ListeningHistorySerializer(history).data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def log_playback_event(request):
    data = request.data.copy()
    data['user'] = request.user.id
    serializer = PlaybackEventSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Playlist.objects.filter(user=self.request.user).prefetch_related('episodes')

    def perform_create(self, serializer):
        # user is already a HiddenField with CurrentUserDefault, but enforce here as well
        serializer.save(user=self.request.user)

class PodcastFollowingViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        ct_podcast = ContentType.objects.get_for_model(Podcast)
        podcast_ids = Favorite.objects.filter(user=self.request.user, content_type=ct_podcast).values_list('object_id', flat=True)
        return Podcast.objects.filter(id__in=podcast_ids)

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return PodcastListSerializer
        return PodcastFollowingCreateSerializer

    def retrieve(self, request, pk=None, *args, **kwargs):
        # Return details only if followed
        try:
            podcast = self.get_queryset().get(pk=pk)
        except Podcast.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        return Response(PodcastListSerializer(podcast).data)

    def create(self, request, *args, **kwargs):
        serializer = PodcastFollowingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        podcast_id = serializer.validated_data['podcast_id']
        if not Podcast.objects.filter(pk=podcast_id).exists():
            return Response({'detail': 'Podcast not found.'}, status=404)
        ct_podcast = ContentType.objects.get_for_model(Podcast)
        Favorite.objects.get_or_create(
            user=request.user,
            content_type=ct_podcast,
            object_id=podcast_id,
        )
        podcast = Podcast.objects.get(pk=podcast_id)
        return Response(PodcastListSerializer(podcast).data, status=201)

    def destroy(self, request, pk=None, *args, **kwargs):
        # pk is treated as podcast_id
        ct_podcast = ContentType.objects.get_for_model(Podcast)
        deleted_count, _ = Favorite.objects.filter(
            user=request.user,
            content_type=ct_podcast,
            object_id=pk,
        ).delete()
        if deleted_count == 0:
            return Response({'detail': 'Favorite not found.'}, status=404)
        return Response(status=204)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).select_related('podcast', 'episode')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()  # scoped to current user by get_queryset
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)
