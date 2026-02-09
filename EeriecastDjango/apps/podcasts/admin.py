from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline
from .models import Podcast, FeedSource
from apps.episodes.models import Episode

class EpisodeInline(TabularInline):
    model = Episode
    extra = 0
    fields = ('title', 'episode_number', 'season_number', 'duration', 'is_premium', 'published_at')
    readonly_fields = ('play_count',)

@admin.register(Podcast)
class PodcastAdmin(ModelAdmin):
    list_display = ('title', 'creator', 'categories_list', 'status', 'is_exclusive', 'rating', 'total_episodes', 'created_at')
    list_filter = ('status', 'is_exclusive', 'categories', 'language', 'created_at')
    search_fields = ('title', 'description', 'creator__display_name', 'tags')
    prepopulated_fields = {'slug': ('title',)}
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    filter_horizontal = ['categories',]

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'slug', 'description', 'creator', 'categories', 'is_trending')
        }),
        ('Media & Content', {
            'fields': ('cover_image', 'language', 'tags')
        }),
        ('Settings', {
            'fields': ('status', 'is_exclusive', 'free_sample_episode')
        }),
        ('Statistics', {
            'fields': ('rating', 'total_episodes', 'total_duration'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('total_episodes', 'total_duration', 'rating')
    inlines = [EpisodeInline]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('creator').prefetch_related('categories')

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Limit free_sample_episode dropdown to episodes belonging to the current podcast."""
        if db_field.name == 'free_sample_episode':
            # When editing a podcast, filter episodes to that podcast only.
            # On add (no object_id), show all episodes as fallback.
            obj_id = request.resolver_match.kwargs.get('object_id')
            if obj_id:
                kwargs['queryset'] = Episode.objects.filter(podcast_id=obj_id).order_by('-published_at')
            else:
                kwargs['queryset'] = Episode.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def categories_list(self, obj):
        return ", ".join(obj.categories.values_list('name', flat=True))
    categories_list.short_description = 'Categories'

@admin.register(FeedSource)
class FeedSourceAdmin(ModelAdmin):
    list_display = (
        'feed_url', 'variant', 'podcast', 'creator', 'category', 'language', 'update_only', 'limit',
        'active', 'last_checked', 'etag', 'last_modified', 'updated_at'
    )
    list_filter = ('active', 'update_only', 'variant', 'category', 'language')
    search_fields = ('feed_url', 'podcast__title')
    ordering = ('-updated_at',)
    fieldsets = (
        (None, {
            'fields': ('feed_url', 'variant', 'active', 'podcast', 'creator', 'category', 'language', 'update_only', 'limit', 'notes')
        }),
        ('State', {
            'fields': ('etag', 'last_modified', 'last_checked', 'last_error'),
            'classes': ('collapse',)
        }),
    )
