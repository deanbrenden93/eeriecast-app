from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q
from apps.podcasts.models import Podcast
from apps.episodes.models import Episode
from apps.creators.models import Creator
from .serializers import SearchPodcastSerializer, SearchEpisodeSerializer, SearchCreatorSerializer

@api_view(['GET'])
@permission_classes([AllowAny])
def global_search(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response({'results': []})
    
    # Search podcasts
    podcasts = Podcast.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query)
    )[:10]
    
    # Search episodes
    episodes = Episode.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query)
    )[:10]
    
    # Search creators
    creators = Creator.objects.filter(
        Q(display_name__icontains=query) | Q(bio__icontains=query)
    )[:10]
    
    return Response({
        'podcasts': SearchPodcastSerializer(podcasts, many=True).data,
        'episodes': SearchEpisodeSerializer(episodes, many=True).data,
        'creators': SearchCreatorSerializer(creators, many=True).data,
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def search_podcasts(request):
    query = request.GET.get('q', '').strip()
    podcasts = Podcast.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query)
    ) if query else Podcast.objects.none()
    
    return Response({
        'results': SearchPodcastSerializer(podcasts, many=True).data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def search_episodes(request):
    query = request.GET.get('q', '').strip()
    episodes = Episode.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query)
    ) if query else Episode.objects.none()
    
    return Response({
        'results': SearchEpisodeSerializer(episodes, many=True).data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def search_creators(request):
    query = request.GET.get('q', '').strip()
    creators = Creator.objects.filter(
        Q(display_name__icontains=query) | Q(bio__icontains=query)
    ) if query else Creator.objects.none()
    
    return Response({
        'results': SearchCreatorSerializer(creators, many=True).data
    })
