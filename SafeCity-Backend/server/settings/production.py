from .base import *

import os

DEBUG = False

ALLOWED_HOSTS = [
    "sdasurvey.cloud",
    "www.sdasurvey.cloud",
    "72.61.229.127",
    "localhost",
    "127.0.0.1"
]


SECRET_KEY = secrets.get("SECRET_KEY", "dev-secret-key")


DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": secrets.get("DB_NAME", "skardusurvey_db"),
        "USER": secrets.get("DB_USER", "skardusurvey_user"),
        "PASSWORD": secrets.get("DB_PASSWORD", "skardusurvey123"),
        "HOST": "72.61.229.127",
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

STATIC_ROOT = BASE_DIR / "staticfiles"

SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"
