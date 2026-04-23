from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0009_add_legacy_trial_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='DOBChangeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_value', models.DateField(blank=True, null=True)),
                ('new_value', models.DateField(blank=True, null=True)),
                ('password_verified', models.BooleanField(default=False)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='dob_change_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-changed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='dobchangelog',
            index=models.Index(fields=['user', '-changed_at'], name='auth_dob_user_id_changed_idx'),
        ),
    ]
