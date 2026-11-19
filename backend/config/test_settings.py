import os

os.environ.setdefault(
    "DJANGO_SECRET_KEY", "test-only-not-for-deployment-at-least-32-characters"
)
os.environ.setdefault("DEBUG", "true")
from .settings import *

DATABASES = {"default": env.db("TEST_DATABASE_URL", default="sqlite://:memory:")}
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    DATABASES["default"]["OPTIONS"] = {"timeout": 20, "transaction_mode": "IMMEDIATE"}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
AIRLABS_API_KEY = ""
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
SECURE_SSL_REDIRECT = False
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
