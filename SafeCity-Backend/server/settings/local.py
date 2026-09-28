from .base import *

# Local development overrides
DEBUG = True


# CORS – allow your React dev server
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]

ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis', 
        'NAME': get_secret("DB_NAME", "safecity"),
        'USER': get_secret("DB_USER", "postgres"),
        'PASSWORD': get_secret("DB_PASSWORD", "admin123"),
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

GDAL_LIBRARY_PATH = get_secret("GDAL_LIBRARY_PATH", "")
GEOS_LIBRARY_PATH = get_secret("GEOS_LIBRARY_PATH", "")
