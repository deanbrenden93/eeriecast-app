from django.core.signing import TimestampSigner
from django.test import TestCase
from rest_framework.test import APIClient

from apps.authentication.models import User
from apps.emails import events as email_events


class AuthenticationEmailFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_verify_email_confirm_marks_user_verified(self):
        user = User.objects.create_user(email='verify@example.com', username='u2', password='pass1234')
        signer = TimestampSigner(salt=email_events.VERIFY_EMAIL_SALT)
        token = signer.sign(str(user.id))

        resp = self.client.post('/api/auth/verify-email/confirm/', {'token': token}, format='json')
        self.assertEqual(resp.status_code, 200)

        user.refresh_from_db()
        self.assertTrue(user.email_verified)
        self.assertIsNotNone(user.email_verified_at)

    def test_password_reset_request_is_non_enumerating(self):
        # Unknown email
        resp1 = self.client.post('/api/auth/password-reset/request/', {'email': 'nope@example.com'}, format='json')
        self.assertEqual(resp1.status_code, 200)

        # Existing email
        User.objects.create_user(email='exists@example.com', username='u3', password='pass1234')
        resp2 = self.client.post('/api/auth/password-reset/request/', {'email': 'exists@example.com'}, format='json')
        self.assertEqual(resp2.status_code, 200)

    def test_soft_delete_endpoint_marks_user_deleted_and_anonymizes_email(self):
        user = User.objects.create_user(email='del@example.com', username='u4', password='pass1234')
        self.client.force_authenticate(user=user)

        resp = self.client.post('/api/auth/users/me/delete/', {}, format='json')
        self.assertEqual(resp.status_code, 204)

        user.refresh_from_db()
        self.assertTrue(user.is_deleted)
        self.assertFalse(user.is_active)
        self.assertEqual(user.email_at_deletion, 'del@example.com')
        self.assertNotEqual(user.email, 'del@example.com')
        self.assertTrue(user.email.startswith('deleted+'))
