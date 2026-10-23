from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import (
    AccessToken,
    BlacklistMixin,
    RefreshToken,
)

from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
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

def revoke_user_tokens(user):
    """Blacklist every outstanding refresh token so all sessions end."""
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)