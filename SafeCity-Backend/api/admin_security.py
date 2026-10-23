from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils.crypto import salted_hmac
from django.http import JsonResponse

def get_client_ip(request):
    if getattr(settings, "ADMIN_TRUST_X_REAL_IP", False):
        ip = request.META.get("HTTP_X_REAL_IP")
        if ip:
            return ip
    return request.META.get("REMOTE_ADDR", "unknown")


class AdminLoginRateLimitMiddleware:
    limit = 5
    window_seconds = 60

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        login_path = f"/{settings.ADMIN_URL_PATH}login/"
        if request.path_info == login_path and request.method == "POST":
            client_key = salted_hmac(
                "admin-login-rate-limit", get_client_ip(request)
            ).hexdigest()
            cache_key = f"admin-login-rate-limit:{client_key}"

            if cache.add(cache_key, 1, timeout=self.window_seconds):
                attempts = 1
            else:
                try:
                    attempts = cache.incr(cache_key)
                except ValueError:
                    if cache.add(cache_key, 1, timeout=self.window_seconds):
                        attempts = 1
                    else:
                        attempts = cache.incr(cache_key)

            if attempts > self.limit:
                response = HttpResponse(
                    "Too many admin login attempts. Please try again later.",
                    status=429,
                )
                response["Retry-After"] = str(self.window_seconds)
                response["Cache-Control"] = "no-store"
                return response

        return self.get_response(request)

def axes_lockout_response(request, credentials, *args, **kwargs):
    message = "Too many failed login attempts. Please try again later."
    if request.path_info.startswith(f"/{settings.ADMIN_URL_PATH}"):
        return HttpResponse(message, status=429)
    return JsonResponse({"status": 429, "message": message, "data": {}}, status=429)

def axes_username(request, credentials):
    if credentials:
        for key in ("username", "email"):
            if credentials.get(key):
                return credentials[key]
    name = getattr(request, "axes_username", None)
    if name:
        return name
    return request.POST.get("username")