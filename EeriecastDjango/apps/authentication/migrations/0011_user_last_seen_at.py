from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0010_dobchangelog'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='last_seen_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
