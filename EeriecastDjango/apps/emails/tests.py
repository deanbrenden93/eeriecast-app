from django.core import mail
from django.test import TestCase, override_settings

from apps.authentication.models import User
from apps.emails.models import EmailEvent
from apps.emails.tasks import send_event_email_task


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='Eeriecast <no-reply@eeriecast.com>',
    EMAIL_SUPPORT='support@eeriecast.com',
    EMAIL_APP_NAME='Eeriecast',
    EMAIL_HOST='smtp.test.local',
    EMAIL_PORT=2525,
    EMAIL_HOST_USER='mailer@test.local',
    EMAIL_USE_TLS=True,
    EMAIL_USE_SSL=False,
)
class EmailEventIdempotencyTests(TestCase):
    def test_send_event_email_task_is_idempotent_by_external_id(self):
        user = User.objects.create_user(email='user@example.com', username='u1', password='pass1234')

        send_event_email_task(
            event_type='TEST',
            to_email='user@example.com',
            external_id='external-1',
            subject='Test subject',
            template_name='emails/account_created_verify.html',
            context={'verify_url': 'https://example.com/verify'},
            user_id=user.id,
        )
        # Second call with same external_id should not send again.
        send_event_email_task(
            event_type='TEST',
            to_email='user@example.com',
            external_id='external-1',
            subject='Test subject',
            template_name='emails/account_created_verify.html',
            context={'verify_url': 'https://example.com/verify'},
            user_id=user.id,
        )

        self.assertEqual(EmailEvent.objects.filter(external_id='external-1').count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('https://example.com/verify', mail.outbox[0].alternatives[0][0])

        email_event = EmailEvent.objects.get(external_id='external-1')
        self.assertEqual(email_event.email_backend, 'django.core.mail.backends.locmem.EmailBackend')
        self.assertEqual(email_event.email_host, 'smtp.test.local')
        self.assertEqual(email_event.email_port, 2525)
        self.assertEqual(email_event.email_host_user, 'mailer@test.local')
        self.assertEqual(email_event.email_use_tls, True)
        self.assertEqual(email_event.email_use_ssl, False)
