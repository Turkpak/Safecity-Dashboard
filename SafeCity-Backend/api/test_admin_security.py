from django.contrib import admin
from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from api.admin import CaptchaAdminLoginForm
from api.admin_security import AdminLoginRateLimitMiddleware
from api.utils import (
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    set_auth_cookies,
)
from api.jwt_tokens import (
    BlacklistableAccessToken,
    CookieRefreshToken,
    CookieTokenRefreshSerializer,
)
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from django.middleware.csrf import get_token
from django.test import RequestFactory

class AdminLoginSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.factory = RequestFactory()

    def tearDown(self):
        cache.clear()

    def test_admin_login_form_requires_captcha(self):
        self.assertIs(admin.site.login_form, CaptchaAdminLoginForm)
        self.assertIn("captcha", CaptchaAdminLoginForm.base_fields)

    def test_admin_login_page_renders_captcha_challenge(self):
        response = self.client.get("/admin/login/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="captcha_0"')
        self.assertContains(response, 'name="captcha_1"')

    def test_admin_login_is_limited_after_five_posts_per_minute(self):
        middleware = AdminLoginRateLimitMiddleware(
            lambda request: HttpResponse(status=200)
        )

        for _ in range(5):
            request = self.factory.post(
                "/admin/login/",
                REMOTE_ADDR="192.0.2.1",
            )
            self.assertEqual(middleware(request).status_code, 200)

        request = self.factory.post(
            "/admin/login/",
            REMOTE_ADDR="192.0.2.1",
        )
        response = middleware(request)

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["Retry-After"], "60")


class AuthCookieSecurityTests(TestCase):
    @override_settings(DEBUG=False)
    def test_auth_cookies_are_http_only_secure_and_strict(self):
        response = set_auth_cookies(
            HttpResponse(),
            {"access": "access-token", "refresh": "refresh-token"},
        )

        for cookie_name in (ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE):
            cookie = response.cookies[cookie_name]
            self.assertTrue(cookie["httponly"])
            self.assertTrue(cookie["secure"])
            self.assertEqual(cookie["samesite"], "Strict")
        self.assertEqual(
            response.cookies[ACCESS_TOKEN_COOKIE]["max-age"],
            900,
        )

    def test_access_token_is_blacklisted_and_rejected_after_logout(self):
        refresh = CookieRefreshToken()
        access_token = refresh.access_token
        raw_access_token = str(access_token)

        self.assertIsInstance(access_token, BlacklistableAccessToken)

        BlacklistableAccessToken(raw_access_token).blacklist()

        with self.assertRaises(TokenError):
            BlacklistableAccessToken(raw_access_token)

    def test_refresh_serializer_issues_blacklistable_access_tokens(self):
        refresh = CookieRefreshToken()
        serializer = CookieTokenRefreshSerializer(
            data={"refresh": str(refresh)}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        BlacklistableAccessToken(serializer.validated_data["access"])

    def test_logout_endpoint_clears_cookies_and_blacklists_tokens(self):
        User = get_user_model()
        user = User.objects.create_user(
            email="logout-test@example.com",
            password="TestPassword123!Secure",
            company_name="Test Company",
        )

        client = APIClient(enforce_csrf_checks=False)

        refresh = CookieRefreshToken.for_user(user)
        access = refresh.access_token

        client.cookies[ACCESS_TOKEN_COOKIE] = str(access)
        client.cookies[REFRESH_TOKEN_COOKIE] = str(refresh)

        # Generate a CSRF token for the test request.
        request = RequestFactory().get("/")
        csrf_token = get_token(request)
        client.cookies["csrftoken"] = csrf_token

        response = client.post(
            "/api/login-user/logout/",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.cookies[ACCESS_TOKEN_COOKIE]["max-age"], 0
        )
        self.assertEqual(
            response.cookies[REFRESH_TOKEN_COOKIE]["max-age"], 0
        )

        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=refresh["jti"]
            ).exists()
        )
        self.assertTrue(
            BlacklistedToken.objects.filter(
                token__jti=access["jti"]
            ).exists()
        )