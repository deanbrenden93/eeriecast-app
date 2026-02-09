# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('episodes', '0001_initial'),
        ('podcasts', '0004_remove_podcast_category_podcast_categories'),
    ]

    operations = [
        migrations.AddField(
            model_name='podcast',
            name='free_sample_episode',
            field=models.ForeignKey(
                blank=True,
                help_text='The episode non-premium users can listen to for free on members-only shows.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='episodes.episode',
            ),
        ),
    ]
