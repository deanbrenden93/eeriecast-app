from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Creator

@admin.register(Creator)
class CreatorAdmin(ModelAdmin):
    list_display = ('display_name', 'is_verified', 'is_featured', 'follower_count', 'created_at')
    list_filter = ('is_verified', 'is_featured', 'created_at')
    search_fields = ('display_name', 'bio', 'user__email')
    ordering = ('-created_at',)

    fieldsets = (
        ('Basic Information', {
            'fields': ('display_name', 'bio')
        }),
        ('Media', {
            'fields': ('avatar', 'cover_image')
        }),
        ('Social & Links', {
            'fields': ('website', 'social_links')
        }),
        ('Status', {
            'fields': ('is_verified', 'is_featured', 'follower_count')
        }),
    )

    readonly_fields = ('follower_count', 'created_at')
