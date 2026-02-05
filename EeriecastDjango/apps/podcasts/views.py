from rest_framework import generics, filters, permissions
from .models import Podcast
from .serializers import PodcastSerializer, PodcastListSerializer

class PodcastListCreateView(generics.ListCreateAPIView):
    queryset = Podcast.objects.select_related('creator').prefetch_related('episodes', 'categories')
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'updated_at', 'title', 'rating']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return PodcastListSerializer
        return PodcastSerializer

    def get_permissions(self):
        """Allow anyone to view podcasts, but require authentication to create"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class PodcastDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Podcast.objects.select_related('creator').prefetch_related('episodes', 'categories')
    serializer_class = PodcastSerializer

    def get_permissions(self):
        """Allow anyone to view podcast details, but require authentication to modify"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]
