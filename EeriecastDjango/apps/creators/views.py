from rest_framework import generics, permissions
from .models import Creator
from .serializers import CreatorSerializer

class CreatorListCreateView(generics.ListCreateAPIView):
    queryset = Creator.objects.all()
    serializer_class = CreatorSerializer
    
    def get_permissions(self):
        """Allow anyone to view creators, but require authentication to create"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class CreatorDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Creator.objects.all()
    serializer_class = CreatorSerializer
    
    def get_permissions(self):
        """Allow anyone to view creator details, but require authentication to modify"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class FeaturedCreatorListView(generics.ListAPIView):
    serializer_class = CreatorSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Creator.objects.filter(is_featured=True).order_by('-created_at')
