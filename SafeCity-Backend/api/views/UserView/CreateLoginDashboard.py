from api.utils import safe_error_data
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from captcha.models import CaptchaStore
from api.jwt_tokens import BlacklistableAccessToken, CookieTokenRefreshSerializer

from ..common_imports import *
from django.contrib.auth import get_user_model

from django.contrib.auth import authenticate
from axes.handlers.proxy import AxesProxyHandler

from api.utils import (
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    clear_auth_cookies,
    enforce_csrf,
    set_auth_cookies,
)


class UserLoginDashboardCreateView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserLoginDashboardSerializer
    permission_classes = [AllowAny]

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def create(self, request):
        enforce_csrf(request)

        try:
            email = request.data.get("email")
            password = request.data.get("password")

            # Django Simple CAPTCHA fields
            captcha_key = request.data.get("captcha_key")
            captcha_value = request.data.get("captcha_value")

            # -----------------------------------------
            # Validate credentials fields
            # -----------------------------------------
            if not email or not password:
                return ApiResponse(
                    message="Credentials missing",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            django_request = request._request   # axes needs the plain Django request, not the DRF wrapper
            credentials = {"username": email}

            if AxesProxyHandler.is_locked(django_request, credentials):
                return ApiResponse(
                    message="Too many failed login attempts. Please try again later.",
                    http_status=status.HTTP_429_TOO_MANY_REQUESTS,
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                ).create_response()
            # -----------------------------------------
            # Validate CAPTCHA fields
            # -----------------------------------------
            if not captcha_key or not captcha_value:
                return ApiResponse(
                    message="CAPTCHA is required.",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            # -----------------------------------------
            # Find CAPTCHA
            # -----------------------------------------
            captcha = CaptchaStore.objects.filter(
                hashkey=captcha_key
            ).first()

            if not captcha:
                return ApiResponse(
                    message="Invalid or expired CAPTCHA.",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST,
                ).create_response()
            if captcha.expiration <= timezone.now():
                captcha.delete()
                return ApiResponse(
                    message="CAPTCHA expired. Please refresh and try again.",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST,
                ).create_response()
            # -----------------------------------------
            # Validate CAPTCHA answer
            # -----------------------------------------
            if captcha.response.strip().lower() != captcha_value.strip().lower():
                # Delete the CAPTCHA after a failed attempt
                # so it cannot be reused.
                captcha.delete()

                return ApiResponse(
                    message="Invalid CAPTCHA.",
                    http_status=status.HTTP_400_BAD_REQUEST,
                    status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            # -----------------------------------------
            # CAPTCHA is valid
            # Delete it so it cannot be reused.
            # -----------------------------------------
            captcha.delete()
            django_request.axes_username = email.strip().lower()
            # -----------------------------------------
            # Authenticate user (axes records failures here)
            # -----------------------------------------
            user = authenticate(
                request=django_request,
                username=email,
                password=password,
            )

            if user is not None:
                auth_data = utils.get_tokens_for_user(user)

                response = ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Login Success",
                    data={},
                    http_status=status.HTTP_200_OK,
                ).create_response()

                set_auth_cookies(response, auth_data)
                return response

            # The failed attempt may have just triggered the lockout
            if AxesProxyHandler.is_locked(django_request, credentials):
                return ApiResponse(
                    message="Too many failed login attempts. Please try again later.",
                    http_status=status.HTTP_429_TOO_MANY_REQUESTS,
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                ).create_response()

            return ApiResponse(
                message="Invalid Credentials",
                http_status=status.HTTP_401_UNAUTHORIZED,
                status=status.HTTP_401_UNAUTHORIZED,
            ).create_response()

            # -----------------------------------------
            # Invalid credentials
            # -----------------------------------------
            return ApiResponse(
                message="Invalid Credentials",
                http_status=status.HTTP_401_UNAUTHORIZED,
                status=status.HTTP_401_UNAUTHORIZED,
            ).create_response()

        except serializers.ValidationError as e:

            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST,
            ).create_response()

        except Exception as e:

            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=safe_error_data(e),
                http_status=status.HTTP_400_BAD_REQUEST,
            ).create_response()

    @action(
        detail=False,
        methods=["post"],
        url_path="refresh",
        throttle_classes=[],
    )
    def refresh(self, request):
        enforce_csrf(request)

        refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)

        if not refresh_token:
            return Response(
                {"message": "Refresh token missing."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = CookieTokenRefreshSerializer(
            data={"refresh": refresh_token}
        )

        if not serializer.is_valid():

            response = Response(
                {"message": "Session expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

            clear_auth_cookies(response)

            return response

        response = Response(
            {
                "status": status.HTTP_200_OK,
                "message": "Token refreshed",
                "data": {},
            }
        )

        set_auth_cookies(
            response,
            serializer.validated_data
        )

        return response

    @action(
        detail=False,
        methods=["post"],
        url_path="logout",
        throttle_classes=[],
    )
    def logout(self, request):
        enforce_csrf(request)

        refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
        access_token = request.COOKIES.get(ACCESS_TOKEN_COOKIE)

        if refresh_token:

            try:
                RefreshToken(refresh_token).blacklist()

            except TokenError:
                pass

        if access_token:
            try:
                BlacklistableAccessToken(access_token).blacklist()
            except TokenError:
                pass

        response = Response(
            {
                "status": status.HTTP_200_OK,
                "message": "Logged out",
                "data": {},
            }
        )

        clear_auth_cookies(response)

        return response