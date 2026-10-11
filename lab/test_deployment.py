import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase, override_settings
from .models import User, MailTask


class ProductionSettingsTests(SimpleTestCase):
    def config(self, **changes):
        env = {**os.environ,
            'NONHUMAN_DEBUG':'0',
            'SECRET_KEY':'ci-only-' + 'aB29xyzPqR' * 6,
            'DATABASE_URL':'postgresql://test:test@localhost/nonhuman',
            'PUBLIC_URL':'https://lab.example.com',
            'RESEND_API_KEY':'ci-only-not-a-real-key',
            'DEFAULT_FROM_EMAIL':'NonHuman <access@example.com>',
            **changes}
        return subprocess.run([sys.executable, '-c',
            'from server import settings as s; assert not s.DEMO_MODE; '
            'assert s.SESSION_COOKIE_SECURE; assert s.CSRF_COOKIE_SECURE; '
            'assert "lab.example.com" in s.ALLOWED_HOSTS; '
            'assert s.DATABASES["default"]["OPTIONS"]["sslmode"] == "require"'],
            env=env, capture_output=True, text=True, cwd=settings.BASE_DIR)

    def test_valid_production_configuration(self):
        result = self.config()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_incomplete_production_configuration_fails_closed(self):
        for changes in [
            {'SECRET_KEY':'short'}, {'SECRET_KEY':'x'*64},
            {'PUBLIC_URL':'http://localhost:5173'},
            {'PUBLIC_URL':'https://lab.example.com/path'},
            {'DATABASE_URL':'sqlite:///:memory:'},
            {'RESEND_API_KEY':''}, {'DEFAULT_FROM_EMAIL':''},
        ]:
            with self.subTest(changes=list(changes)):
                self.assertNotEqual(self.config(**changes).returncode, 0)


class DeploymentTests(TestCase):
    @patch.object(Path, 'is_file', return_value=True)
    def test_health_is_anonymous_and_uncached(self, exists):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status':'ok'})
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(response['X-Frame-Options'], 'DENY')

    @patch('server.urls.connection.cursor', side_effect=DatabaseError('private connection detail'))
    def test_health_does_not_expose_database_error(self, cursor):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {'status':'unavailable'})

    @patch.object(Path, 'is_file', return_value=False)
    def test_health_requires_frontend_build(self, exists):
        self.assertEqual(self.client.get('/healthz').status_code, 503)

    @override_settings(SECURE_SSL_REDIRECT=True)
    @patch.object(Path, 'is_file', return_value=True)
    def test_health_checks_database_instead_of_redirecting(self, exists):
        self.assertEqual(self.client.get('/healthz').status_code, 200)
        self.assertEqual(self.client.get('/api/session').status_code, 301)

    def test_api_session_is_not_cacheable(self):
        response = self.client.get('/api/session')
        self.assertIn('no-store', response['Cache-Control'])

    def test_bootstrap_is_idempotent_without_default_password(self):
        with patch.dict(os.environ, {'BOOTSTRAP_ADMIN_DNI':'12345678',
                'BOOTSTRAP_ADMIN_EMAIL':'admin@example.com', 'BOOTSTRAP_ADMIN_NAME':'Admin'}):
            call_command('bootstrap_admin', verbosity=0)
            call_command('bootstrap_admin', verbosity=0)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(User.objects.get().role, 'admin')
        self.assertFalse(User.objects.get().has_usable_password())
        self.assertEqual(MailTask.objects.count(), 1)

    def test_bootstrap_requires_first_admin(self):
        with patch.dict(os.environ, {'BOOTSTRAP_ADMIN_DNI':''}):
            with self.assertRaises(CommandError):
                call_command('bootstrap_admin')
