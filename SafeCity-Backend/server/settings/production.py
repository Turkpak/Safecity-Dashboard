from .base import *
from django.core.exceptions import ImproperlyConfigured
import os

DEBUG = False

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1"
]


SECRET_KEY = secrets.get("SECRET_KEY", "dev-secret-key")

ADMIN_URL_PATH = get_secret("ADMIN_PATH").strip("/") + "/"
if ADMIN_URL_PATH == "admin/":
    raise ImproperlyConfigured("ADMIN_PATH must not be the default 'admin'.")
ADMIN_TRUST_X_REAL_IP = True
AXES_IPWARE_META_PRECEDENCE_ORDER = ["HTTP_X_REAL_IP", "REMOTE_ADDR"]

CACHES = {   # shared across gunicorn workers, so rate limits are not per-worker
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "django_cache",
    }
}

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": secrets.get("DB_NAME", "safecity"),
        "USER": secrets.get("DB_USER", "postgres"),
        "PASSWORD": secrets.get("DB_PASSWORD", "Postgres"),
        "HOST": "localhost",
        "PORT": "5432",
    }
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},   # was DEBUG
    'loggers': {
        'axes': {'level': 'WARNING'},
        'admin.audit': {'level': 'WARNING'},
    },
}

# LOGGING = {
#     'version': 1,
#     'disable_existing_loggers': False,
#     'handlers': {
#         'console': {
#             'class': 'logging.StreamHandler',
#         },
#     },
#     'root': {
#         'handlers': ['console'],
#         'level': 'DEBUG',
#     },
# }

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    
]

CSRF_TRUSTED_ORIGINS = [
    
]

# SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"


