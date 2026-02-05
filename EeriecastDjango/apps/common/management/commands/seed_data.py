import random
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from apps.categories.models import Category
from apps.creators.models import Creator
from apps.podcasts.models import Podcast
from apps.episodes.models import Episode
from apps.library.models import Favorite, Following, ListeningHistory

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with sample data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Clearing existing data...')
            self.clear_data()

        self.stdout.write('Starting database seeding...')

        # Create sample data
        users = self.create_users()
        categories = self.create_categories()
        creators = self.create_creators(users)
        podcasts = self.create_podcasts(creators, categories)
        episodes = self.create_episodes(podcasts)
        self.create_library_data(users, creators, episodes)

        self.stdout.write(
            self.style.SUCCESS('Successfully seeded database with sample data!')
        )

    def clear_data(self):
        """Clear existing data"""
        ListeningHistory.objects.all().delete()
        Following.objects.all().delete()
        Favorite.objects.all().delete()
        Episode.objects.all().delete()
        Podcast.objects.all().delete()
        Creator.objects.all().delete()
        Category.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write('Existing data cleared.')

    def create_users(self):
        """Create sample users"""
        self.stdout.write('Creating users...')
        users = []

        sample_users = [
            {'username': 'john_doe', 'email': 'john@example.com', 'first_name': 'John', 'last_name': 'Doe'},
            {'username': 'jane_smith', 'email': 'jane@example.com', 'first_name': 'Jane', 'last_name': 'Smith'},
            {'username': 'mike_johnson', 'email': 'mike@example.com', 'first_name': 'Mike', 'last_name': 'Johnson'},
            {'username': 'sarah_wilson', 'email': 'sarah@example.com', 'first_name': 'Sarah', 'last_name': 'Wilson'},
            {'username': 'alex_brown', 'email': 'alex@example.com', 'first_name': 'Alex', 'last_name': 'Brown'},
            {'username': 'emily_davis', 'email': 'emily@example.com', 'first_name': 'Emily', 'last_name': 'Davis'},
            {'username': 'chris_miller', 'email': 'chris@example.com', 'first_name': 'Chris', 'last_name': 'Miller'},
            {'username': 'lisa_garcia', 'email': 'lisa@example.com', 'first_name': 'Lisa', 'last_name': 'Garcia'},
            {'username': 'david_martinez', 'email': 'david@example.com', 'first_name': 'David', 'last_name': 'Martinez'},
            {'username': 'anna_lopez', 'email': 'anna@example.com', 'first_name': 'Anna', 'last_name': 'Lopez'},
        ]

        for user_data in sample_users:
            user, created = User.objects.get_or_create(
                email=user_data['email'],
                defaults={
                    'username': user_data['username'],
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'is_premium': random.choice([True, False]),
                    'minutes_listened': random.randint(0, 10000),
                    'bio': f"I'm {user_data['first_name']}, a podcast enthusiast!",
                    'avatar': f"https://ui-avatars.com/api/?name={user_data['first_name']}+{user_data['last_name']}&background=random",
                }
            )
            if created:
                user.set_password('password123')
                user.save()
            users.append(user)

        self.stdout.write(f'Created {len(users)} users')
        return users

    def create_categories(self):
        """Create sample categories"""
        self.stdout.write('Creating categories...')
        categories = []

        category_names = [
            'Technology', 'Business', 'Health & Fitness', 'Comedy', 'Education',
            'Science', 'True Crime', 'Sports', 'Music', 'Arts & Entertainment'
        ]

        for name in category_names:
            category, created = Category.objects.get_or_create(
                name=name,
                defaults={
                    'slug': slugify(name),
                    'description': f'Podcasts about {name.lower()} and related topics.',
                    'cover_image': f'https://picsum.photos/400/400?random={random.randint(1, 1000)}'
                }
            )
            categories.append(category)

        self.stdout.write(f'Created {len(categories)} categories')
        return categories

    def create_creators(self, users):
        """Create sample creators"""
        self.stdout.write('Creating creators...')
        creators = []

        for i, user in enumerate(users):
            creator, created = Creator.objects.get_or_create(
                user=user,
                defaults={
                    'display_name': f"{user.first_name} {user.last_name}",
                    'bio': f"Creator and host with {random.randint(1, 10)} years of podcasting experience. Passionate about sharing knowledge and entertaining stories.",
                    'avatar': user.avatar,
                    'cover_image': f'https://picsum.photos/800/400?random={random.randint(1000, 2000)}',
                    'website': f'https://{user.username}.com',
                    'social_links': {
                        'twitter': f'@{user.username}',
                        'instagram': f'@{user.username}',
                        'linkedin': f'/in/{user.username}'
                    },
                    'is_verified': random.choice([True, False]),
                    'follower_count': random.randint(100, 50000)
                }
            )
            creators.append(creator)

        self.stdout.write(f'Created {len(creators)} creators')
        return creators

    def create_podcasts(self, creators, categories):
        """Create sample podcasts"""
        self.stdout.write('Creating podcasts...')
        podcasts = []

        podcast_titles = [
            'Tech Talk Weekly', 'Business Insights', 'Healthy Living Tips', 'Comedy Hour',
            'Learning Made Easy', 'Science Explained', 'Crime Stories', 'Sports Talk',
            'Music & More', 'Art & Culture', 'Daily Motivation', 'Future Trends',
            'Life Hacks', 'Creative Minds', 'Innovation Hub'
        ]

        for i in range(15):  # Create 15 podcasts (more than creators to test multiple podcasts per creator)
            title = podcast_titles[i % len(podcast_titles)]
            if i >= len(podcast_titles):
                title = f"{title} Season {i // len(podcast_titles) + 1}"

            creator = random.choice(creators)
            category = random.choice(categories)

            podcast = Podcast.objects.create(
                title=title,
                slug=slugify(f"{title}-{creator.display_name}"),
                description=f"Welcome to {title}! Join {creator.display_name} as they explore the fascinating world of {category.name.lower()}. Each episode brings you insights, interviews, and engaging discussions.",
                creator=creator,
                category=category,
                cover_image=f'https://picsum.photos/800/800?random={random.randint(2000, 3000)}',
                status=random.choice(['active', 'inactive', 'draft']),
                is_premium=random.choice([True, False]),
                rating=round(random.uniform(3.0, 5.0), 2),
                total_episodes=random.randint(5, 50),
                total_duration=random.randint(300, 3000),  # in minutes
                language=random.choice(['en', 'es', 'fr']),
                tags=[
                    random.choice(['educational', 'entertaining', 'informative', 'inspiring']),
                    random.choice(['weekly', 'daily', 'monthly']),
                    category.name.lower().replace(' ', '-')
                ]
            )
            podcasts.append(podcast)

        self.stdout.write(f'Created {len(podcasts)} podcasts')
        return podcasts

    def create_episodes(self, podcasts):
        """Create sample episodes"""
        self.stdout.write('Creating episodes...')
        episodes = []

        episode_templates = [
            "Intro to {topic}",
            "Deep Dive {topic}",
            "Expert Talk {topic}",
            "Top Tips {topic}",
            "Mistakes in {topic}",
            "Future of {topic}",
            "Beginner {topic}",
            "Advanced {topic}",
            "Q&A {topic}",
            "Case Study {topic}"
        ]

        for podcast in podcasts:
            num_episodes = random.randint(3, 12)  # Each podcast gets 3-12 episodes

            for episode_num in range(1, num_episodes + 1):
                template = random.choice(episode_templates)
                topic = podcast.category.name if podcast.category else "General"
                # Keep topic short for slug generation
                if len(topic) > 15:
                    topic = topic[:15]

                title = template.format(topic=topic)
                # Create a shorter, more manageable slug
                slug_base = f"ep-{episode_num}-{slugify(topic[:10])}"

                published_date = timezone.now() - timedelta(days=random.randint(1, 365))

                episode = Episode.objects.create(
                    podcast=podcast,
                    title=f"{title} - Episode {episode_num}",
                    slug=slug_base,  # Use shorter slug
                    description=f"In this episode of {podcast.title}, we explore {title.lower()}. Join us for an engaging discussion with practical insights and actionable advice.",
                    audio_url=f"https://example.com/audio/{podcast.slug}-{slug_base}.mp3",
                    duration=random.randint(1200, 7200),  # 20 minutes to 2 hours in seconds
                    episode_number=episode_num,
                    season_number=random.randint(1, 3),
                    is_premium=random.choice([True, False]),
                    transcript=f"This is a sample transcript for {title}. In this episode, we discuss various aspects of the topic and provide valuable insights...",
                    cover_image=f'https://picsum.photos/600/600?random={random.randint(3000, 4000)}',
                    play_count=random.randint(10, 10000),
                    published_at=published_date
                )
                episodes.append(episode)

        self.stdout.write(f'Created {len(episodes)} episodes')
        return episodes

    def create_library_data(self, users, creators, episodes):
        """Create sample library data (favorites, following, listening history)"""
        self.stdout.write('Creating library data...')

        # Create following relationships
        for user in users:
            # Each user follows 2-5 random creators
            num_following = random.randint(2, 5)
            creators_to_follow = random.sample(creators, min(num_following, len(creators)))

            for creator in creators_to_follow:
                Following.objects.get_or_create(user=user, creator=creator)

        # Create listening history
        for user in users:
            # Each user has listened to 5-15 random episodes
            num_episodes = random.randint(5, 15)
            episodes_listened = random.sample(episodes, min(num_episodes, len(episodes)))

            for episode in episodes_listened:
                progress = random.randint(0, episode.duration)
                completed = progress >= episode.duration * 0.9  # Consider 90%+ as completed

                ListeningHistory.objects.get_or_create(
                    user=user,
                    episode=episode,
                    defaults={
                        'progress': progress,
                        'completed': completed,
                        'last_played': timezone.now() - timedelta(days=random.randint(0, 30))
                    }
                )

        # Create some favorites (using episodes as an example)
        from django.contrib.contenttypes.models import ContentType
        episode_content_type = ContentType.objects.get_for_model(Episode)

        for user in users:
            # Each user favorites 2-8 random episodes
            num_favorites = random.randint(2, 8)
            favorite_episodes = random.sample(episodes, min(num_favorites, len(episodes)))

            for episode in favorite_episodes:
                Favorite.objects.get_or_create(
                    user=user,
                    content_type=episode_content_type,
                    object_id=episode.id
                )

        following_count = Following.objects.count()
        history_count = ListeningHistory.objects.count()
        favorites_count = Favorite.objects.count()

        self.stdout.write(f'Created {following_count} following relationships')
        self.stdout.write(f'Created {history_count} listening history entries')
        self.stdout.write(f'Created {favorites_count} favorite entries')
