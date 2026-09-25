from .base import *

import os

DEBUG = False

ALLOWED_HOSTS = [
    "safecity.nespakprogresscenter.com",
    "www.safecity.nespakprogresscenter.com",
    "10.1.10.1",
    "localhost",
    "127.0.0.1"
]


SECRET_KEY = secrets.get("SECRET_KEY", "dev-secret-key")


DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": secrets.get("DB_NAME", "safecity"),
        "USER": secrets.get("DB_USER", "postgres"),
        "PASSWORD": secrets.get("DB_PASSWORD", "Postgres"),
        "HOST": "10.1.10.1",
        "PORT": "5432",
    }
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
}

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "https://safecity.nespakprogresscenter.com",
]

CSRF_TRUSTED_ORIGINS = [
    "https://safecity.nespakprogresscenter.com",
]
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"
