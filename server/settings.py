import os
from pathlib import Path
from urllib.parse import urlsplit
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('NONHUMAN_DEBUG', '1') == '1'
SECRET_KEY = os.getenv('SECRET_KEY', 'local-only-nonhuman-development-key')
if not DEBUG and (len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5):
    raise RuntimeError('SECRET_KEY must be a random secret of at least 50 characters in production')
ALLOWED_HOSTS = [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver' if DEBUG else '').split(',') if host.strip()]
if os.getenv('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
PUBLIC_URL = os.getenv('PUBLIC_URL', 'http://localhost:5173').rstrip('/')
if not DEBUG:
    public_origin = urlsplit(PUBLIC_URL)
    if (public_origin.scheme != 'https' or not public_origin.hostname
            or public_origin.path or public_origin.query or public_origin.fragment
            or public_origin.username or public_origin.password
            or public_origin.hostname in ('localhost', '127.0.0.1', '::1')):
        raise RuntimeError('PUBLIC_URL must be the public HTTPS origin without a path')
    ALLOWED_HOSTS.append(public_origin.hostname)
CSRF_TRUSTED_ORIGINS = [PUBLIC_URL, 'http://127.0.0.1:5173'] if DEBUG else [PUBLIC_URL]
INSTALLED_APPS = ['django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.staticfiles','axes','lab']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware','whitenoise.middleware.WhiteNoiseMiddleware','django.contrib.sessions.middleware.SessionMiddleware','django.middleware.common.CommonMiddleware','django.middleware.csrf.CsrfViewMiddleware','django.contrib.auth.middleware.AuthenticationMiddleware','django.middleware.clickjacking.XFrameOptionsMiddleware','axes.middleware.AxesMiddleware']
ROOT_URLCONF = 'server.urls'
WSGI_APPLICATION = 'server.wsgi.application'
DATABASES = {'default': dj_database_url.config(default=f'sqlite:///{BASE_DIR / "db.sqlite3"}', conn_max_age=60, conn_health_checks=True)}
if not DEBUG and DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise RuntimeError('DATABASE_URL PostgreSQL is required in production')
if not DEBUG:
    DATABASES['default'].setdefault('OPTIONS', {})['sslmode'] = 'require'
AUTH_USER_MODEL = 'lab.User'
AUTHENTICATION_BACKENDS = ['axes.backends.AxesStandaloneBackend','django.contrib.auth.backends.ModelBackend']
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 0.25
AXES_LOCKOUT_PARAMETERS = ['username', 'ip_address']
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_CALLABLE = 'lab.views.lockout'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':10}},
    {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_REDIRECT_EXEMPT = [r'^healthz$']
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_CONTENT_TYPE_NOSNIFF = True
TIME_ZONE = 'America/Lima'
USE_TZ = True
LANGUAGE_CODE = 'es-pe'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
WHITENOISE_ROOT = BASE_DIR / 'dist'
WHITENOISE_MIMETYPES = {'.webmanifest': 'application/manifest+json'}
PASSWORD_RESET_TIMEOUT = 3600
EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend' if DEBUG else 'lab.email_backend.ResendBackend'
EMAIL_FILE_PATH = BASE_DIR / 'local-emails'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'NonHuman <acceso@lab.nonhuman.lat>')
RESEND_API_KEY = os.getenv('RESEND_API_KEY', '')
if not DEBUG and (not RESEND_API_KEY or not os.getenv('DEFAULT_FROM_EMAIL')):
    raise RuntimeError('RESEND_API_KEY and DEFAULT_FROM_EMAIL are required for production invitations')
DEMO_MODE = DEBUG and os.getenv('DEMO_MODE', '1') == '1'
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
