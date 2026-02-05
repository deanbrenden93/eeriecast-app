from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Favorite, Following, ListeningHistory, Playlist, Notification

@admin.register(Favorite)
class FavoriteAdmin(ModelAdmin):
    list_display = ('user', 'content_type', 'object_id', 'created_at')
    list_filter = ('content_type', 'created_at')
    search_fields = ('user__id',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'content_type')

@admin.register(Following)
class FollowingAdmin(ModelAdmin):
    list_display = ('user', 'creator', 'created_at')
    list_filter = ('created_at', 'creator__is_verified')
    search_fields = ('user__id', 'creator__display_name')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'creator')

@admin.register(ListeningHistory)
class ListeningHistoryAdmin(ModelAdmin):
    list_display = ('user', 'episode', 'progress_display', 'completed', 'last_played')
    list_filter = ('completed', 'last_played', 'episode__is_premium')
    search_fields = ('user__id', 'episode__title', 'episode__podcast__title')
    ordering = ('-last_played',)
    date_hierarchy = 'last_played'
    
    fieldsets = (
        ('User & Episode', {
            'fields': ('user', 'episode')
        }),
        ('Progress', {
            'fields': ('progress', 'completed')
        }),
        ('Timestamps', {
            'fields': ('last_played', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('created_at',)
    
    def progress_display(self, obj):
        """Display progress in minutes and seconds"""
        minutes = obj.progress // 60
        seconds = obj.progress % 60
        return f"{minutes}m {seconds}s"
    progress_display.short_description = 'Progress'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'episode', 'episode__podcast')


@admin.register(Playlist)
class PlaylistAdmin(ModelAdmin):
    list_display = ('name', 'user', 'approximate_length_minutes', 'updated_at')
    search_fields = ('name', 'user__id')
    list_filter = ('updated_at', 'created_at')
    ordering = ('-updated_at',)
    filter_horizontal = ('episodes',)


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ('user', 'podcast', 'episode', 'is_read', 'created_at')
    list_filter = ('is_read', 'created_at', 'podcast')
    search_fields = ('user__id', 'podcast__title', 'episode__title')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'podcast', 'episode')
