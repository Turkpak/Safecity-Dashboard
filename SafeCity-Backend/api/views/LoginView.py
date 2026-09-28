from .common_imports import *

from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from api.utils import enforce_csrf, set_auth_cookies


@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({"detail": "CSRF cookie set"})


class LoginView(APIView):
    def post(self, request):
        enforce_csrf(request)
        if 'email' not in request.data or 'password' not in request.data:
            return Response({'msg': 'Credentials missing'}, status=status.HTTP_400_BAD_REQUEST)
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, email=email, password=password)
        if user is not None:
            auth_data = utils.get_tokens_for_user(user)
            verified = user.is_verified

            res = {
                'msg': {
                    'login': 'Login Success',
                    'verified': verified,
                },
            }
            response = Response(res, status=status.HTTP_200_OK)
            set_auth_cookies(response, auth_data)
            return response
        return Response({'msg': 'Invalid Credentials'}, status=status.HTTP_401_UNAUTHORIZED)