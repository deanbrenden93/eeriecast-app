from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Episode

@admin.register(Episode)
class EpisodeAdmin(ModelAdmin):
    list_display = ('title', 'podcast', 'episode_number', 'season_number', 'duration_display', 'is_premium', 'play_count', 'published_at')
    list_filter = (
        'is_premium',
        'published_at',
        ('podcast__categories', admin.RelatedOnlyFieldListFilter),
        'season_number',
    )
    search_fields = ('title', 'description', 'podcast__title', 'transcript')
    prepopulated_fields = {'slug': ('title',)}
    ordering = ('-published_at',)
    date_hierarchy = 'published_at'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('podcast', 'title', 'slug', 'description')
        }),
        ('Episode Details', {
            'fields': ('episode_number', 'season_number', 'duration', 'is_premium')
        }),
        ('Media', {
            'fields': ('ad_free_audio_url', 'ad_supported_audio_url', 'cover_image')
        }),
        ('Content', {
            'fields': ('transcript',),
            'classes': ('collapse',)
        }),
        ('Publishing', {
            'fields': ('published_at',)
        }),
        ('Statistics', {
            'fields': ('play_count',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('play_count', 'created_at')
    
    def duration_display(self, obj):
        """Display duration in minutes and seconds"""
        minutes = obj.duration // 60
        seconds = obj.duration % 60
        return f"{minutes}m {seconds}s"
    duration_display.short_description = 'Duration'
