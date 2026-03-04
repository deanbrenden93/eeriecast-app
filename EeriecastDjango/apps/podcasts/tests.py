from types import SimpleNamespace
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.creators.models import Creator
from apps.episodes.models import Episode
from apps.podcasts.models import FeedSource, Podcast


class SyncRssVariantPersistenceTests(TestCase):
    def setUp(self):
        self.creator = Creator.objects.create(display_name="Test Creator")
        self.podcast = Podcast.objects.create(
            title="Test Podcast",
            slug="test-podcast",
            description="",
            creator=self.creator,
            cover_image="",
        )

    @patch("apps.podcasts.management.commands.sync_rss.feedparser.parse")
    @patch("apps.podcasts.management.commands.sync_rss.requests.get")
    def test_new_episode_persists_ad_free_audio_url(self, mock_get, mock_parse):
        feed_url = "https://feeds.example.com/ad-free"
        audio_url = "https://cdn.example.com/episode-ad-free.mp3"

        FeedSource.objects.create(
            podcast=self.podcast,
            feed_url=feed_url,
            variant="ad_free",
            active=True,
        )

        mock_get.return_value = SimpleNamespace(status_code=200, headers={}, content=b"<rss />")
        mock_parse.return_value = SimpleNamespace(
            feed={"title": "Test Podcast"},
            entries=[
                {
                    "title": "Episode One",
                    "summary": "Description",
                    "enclosures": [{"href": audio_url}],
                }
            ],
        )

        call_command("sync_rss", feed_url=feed_url)

        ep = Episode.objects.get(podcast=self.podcast, title="Episode One")
        self.assertEqual(ep.ad_free_audio_url, audio_url)

    @patch("apps.podcasts.management.commands.sync_rss.feedparser.parse")
    @patch("apps.podcasts.management.commands.sync_rss.requests.get")
    def test_new_episode_persists_ad_supported_audio_url(self, mock_get, mock_parse):
        feed_url = "https://feeds.example.com/ad-supported"
        audio_url = "https://cdn.example.com/episode-ad-supported.mp3"

        FeedSource.objects.create(
            podcast=self.podcast,
            feed_url=feed_url,
            variant="ad_supported",
            active=True,
        )

        mock_get.return_value = SimpleNamespace(status_code=200, headers={}, content=b"<rss />")
        mock_parse.return_value = SimpleNamespace(
            feed={"title": "Test Podcast"},
            entries=[
                {
                    "title": "Episode Two",
                    "summary": "Description",
                    "enclosures": [{"href": audio_url}],
                }
            ],
        )

        call_command("sync_rss", feed_url=feed_url)

        ep = Episode.objects.get(podcast=self.podcast, title="Episode Two")
        self.assertEqual(ep.ad_supported_audio_url, audio_url)
