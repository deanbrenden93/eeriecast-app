from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('episodes', '0007_comment'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Comment',
        ),
    ]
