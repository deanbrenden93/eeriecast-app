from rest_framework import generics, filters, permissions
from .models import Episode
from .serializers import EpisodeSerializer

class EpisodeListCreateView(generics.ListCreateAPIView):
    queryset = Episode.objects.select_related('podcast', 'podcast__creator')
    serializer_class = EpisodeSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['-published_at']

    def get_permissions(self):
        """Allow anyone to view episodes, but require authentication to create"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class EpisodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Episode.objects.select_related('podcast', 'podcast__creator')
    serializer_class = EpisodeSerializer

    def get_permissions(self):
        """Allow anyone to view episode details, but require authentication to modify"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
