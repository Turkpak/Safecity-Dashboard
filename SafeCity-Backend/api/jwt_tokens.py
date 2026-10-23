from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import (
    AccessToken,
    BlacklistMixin,
    RefreshToken,
)


class BlacklistableAccessToken(
    BlacklistMixin["BlacklistableAccessToken"],
    AccessToken,
):
    pass


class CookieRefreshToken(RefreshToken):
    access_token_class = BlacklistableAccessToken


class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = CookieRefreshToken
