from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.categories.models import Category
from apps.creators.models import Creator
from apps.episodes.models import Episode
from apps.library.models import ListeningHistory, PlaybackEvent
from apps.podcasts.models import Podcast


User = get_user_model()


class EpisodeFeedEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.creator = Creator.objects.create(display_name="Creator")
        self.category_horror = Category.objects.create(name="Horror", slug="horror")
        self.category_audiobook = Category.objects.create(name="Audiobook", slug="audiobook")

    def _create_podcast(self, title, slug, is_exclusive=False, categories=None):
        podcast = Podcast.objects.create(
            title=title,
            slug=slug,
            description=f"{title} description",
            creator=self.creator,
            cover_image="https://example.com/cover.jpg",
            is_exclusive=is_exclusive,
        )
        if categories:
            podcast.categories.set(categories)
        return podcast

    def _create_episode(self, podcast, slug, title, description, published_at, is_premium=False):
        return Episode.objects.create(
            podcast=podcast,
            title=title,
            slug=slug,
            description=description,
            audio_url="https://example.com/audio.mp3",
            duration=1800,
            is_premium=is_premium,
            published_at=published_at,
        )

    def test_trending_orders_by_recent_velocity(self):
        podcast = self._create_podcast("Signal", "signal", categories=[self.category_horror])
        now = timezone.now()
        episode_fast = self._create_episode(
            podcast=podcast,
            slug="ep-fast",
            title="Fast Rise",
            description="Rising quickly",
            published_at=now - timedelta(days=2),
        )
        episode_slow = self._create_episode(
            podcast=podcast,
            slug="ep-slow",
            title="Slow Rise",
            description="Rising slowly",
            published_at=now - timedelta(days=1),
        )

        user = User.objects.create_user(email="listener@example.com", username="listener", password="test1234")
        for _ in range(5):
            event = PlaybackEvent.objects.create(user=user, episode=episode_fast, event="play", position=0, duration=1800)
            PlaybackEvent.objects.filter(pk=event.pk).update(created_at=now - timedelta(hours=2))
        for _ in range(2):
            event = PlaybackEvent.objects.create(user=user, episode=episode_slow, event="play", position=0, duration=1800)
            PlaybackEvent.objects.filter(pk=event.pk).update(created_at=now - timedelta(hours=3))

        response = self.client.get("/api/episodes/trending/?window_hours=48&min_volume=1&page_size=10")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertGreaterEqual(len(results), 2)
        self.assertEqual(results[0]["id"], episode_fast.id)
        self.assertEqual(results[1]["id"], episode_slow.id)

    def test_trending_falls_back_to_newest_when_volume_low_and_excludes_audiobooks(self):
        normal_podcast = self._create_podcast("Regular Show", "regular-show", categories=[self.category_horror])
        audiobook_podcast = self._create_podcast("Book Show", "book-show", categories=[self.category_audiobook])
        now = timezone.now()
        newest_audiobook_episode = self._create_episode(
            podcast=audiobook_podcast,
            slug="audio-ep",
            title="Book Chapter",
            description="Audio chapter",
            published_at=now - timedelta(hours=1),
        )
        newest_regular_episode = self._create_episode(
            podcast=normal_podcast,
            slug="new-regular",
            title="Newest Regular",
            description="Regular newest",
            published_at=now - timedelta(hours=2),
        )
        older_regular_episode = self._create_episode(
            podcast=normal_podcast,
            slug="old-regular",
            title="Older Regular",
            description="Regular older",
            published_at=now - timedelta(days=2),
        )

        response = self.client.get("/api/episodes/trending/?min_volume=999&page_size=10")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        returned_ids = [row["id"] for row in results]

        self.assertIn(newest_regular_episode.id, returned_ids)
        self.assertIn(older_regular_episode.id, returned_ids)
        self.assertNotIn(newest_audiobook_episode.id, returned_ids)
        self.assertLess(returned_ids.index(newest_regular_episode.id), returned_ids.index(older_regular_episode.id))

    def test_recommended_scores_by_recent_history_and_excludes_watched(self):
        podcast = self._create_podcast("Paranormal Signals", "paranormal-signals", categories=[self.category_horror])
        now = timezone.now()

        listened_episode = self._create_episode(
            podcast=podcast,
            slug="listened",
            title="Mothman Woods Encounter",
            description="Cryptid lights in the woods",
            published_at=now - timedelta(days=20),
        )
        match_episode = self._create_episode(
            podcast=podcast,
            slug="match",
            title="Mothman Signal in Dark Woods",
            description="Signal patterns and cryptid clues",
            published_at=now - timedelta(days=1),
        )
        self._create_episode(
            podcast=podcast,
            slug="non-match",
            title="Haunted Pantry",
            description="Kitchen noises and cold spots",
            published_at=now - timedelta(days=1),
        )

        user = User.objects.create_user(email="reco@example.com", username="reco", password="test1234")
        self.client.force_authenticate(user=user)
        ListeningHistory.objects.create(
            user=user,
            episode=listened_episode,
            progress=300,
            duration=1800,
            last_played=now - timedelta(days=2),
        )

        response = self.client.get("/api/episodes/recommended/?page_size=10")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        returned_ids = [row["id"] for row in results]

        self.assertIn(match_episode.id, returned_ids)
        self.assertNotIn(listened_episode.id, returned_ids)

    def test_recommended_fallback_for_anonymous_returns_only_free_non_audiobook(self):
        free_podcast = self._create_podcast("Free Show", "free-show", categories=[self.category_horror])
        exclusive_podcast = self._create_podcast(
            "Members Show",
            "members-show",
            is_exclusive=True,
            categories=[self.category_horror],
        )
        audiobook_podcast = self._create_podcast("Audio Book", "audio-book", categories=[self.category_audiobook])
        now = timezone.now()

        free_episode = self._create_episode(
            podcast=free_podcast,
            slug="free-episode",
            title="Free Episode",
            description="General story",
            published_at=now - timedelta(days=1),
            is_premium=False,
        )
        self._create_episode(
            podcast=exclusive_podcast,
            slug="exclusive-episode",
            title="Exclusive Episode",
            description="Members only",
            published_at=now - timedelta(days=1),
            is_premium=False,
        )
        self._create_episode(
            podcast=free_podcast,
            slug="premium-episode",
            title="Premium Episode",
            description="Premium gate",
            published_at=now - timedelta(days=1),
            is_premium=True,
        )
        self._create_episode(
            podcast=audiobook_podcast,
            slug="book-episode",
            title="Book Episode",
            description="Book chapter",
            published_at=now - timedelta(days=1),
            is_premium=False,
        )

        response = self.client.get("/api/episodes/recommended/?page_size=10")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        returned_ids = {row["id"] for row in results}
        self.assertEqual(returned_ids, {free_episode.id})
