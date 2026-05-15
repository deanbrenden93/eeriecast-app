from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('episodes', '0008_delete_comment'),
    ]

    operations = [
        migrations.AddField(
            model_name='episode',
            name='ad_free_duration',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]
