from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from ..common_imports import *
from django.contrib.auth import get_user_model
from api.utils import clear_auth_cookies, enforce_csrf, set_auth_cookies

class UserLoginDashboardCreateView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserLoginDashboardSerializer
    permission_classes = [AllowAny]

    def create(self, request):
        enforce_csrf(request)
        
        user=request.user
        try:
            
            email = request.data.get('email')
            password = request.data.get('password')


            if not email or not password:
                return ApiResponse(
                    message="Credentials missing", 
                    http_status=status.HTTP_400_BAD_REQUEST, status=status.HTTP_400_BAD_REQUEST).create_response()

            user = get_user_model().objects.filter(email=email).first()
            
            if user and user.check_password(password) and user.is_active:
                auth_data = utils.get_tokens_for_user(user)

                permissions = UserPermission.objects.filter(user=user)
                permissions_data = UserPermissionSerializer(permissions, many=True).data

                verified = user.is_verified
            
                res = {
                    'msg': {
                        'login': 'Login Success',
                        'verified': verified,
                    },
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'id': user.id,
                    'role': user.role,
                    'permissions': permissions_data,
                    'stakeholder_id': user.stakeholder.id if user.stakeholder else None,
                    'stakeholder_type': user.stakeholder.stakeholder_type if user.stakeholder else None,
                    'is_active': user.is_active,
                }
                response = ApiResponse(
                    status=status.HTTP_200_OK, message="Login Success", data=res, http_status=status.HTTP_200_OK
                    ).create_response()
                set_auth_cookies(response, auth_data)
                return response

            return ApiResponse(
                message="Invalid Credentials", http_status=status.HTTP_401_UNAUTHORIZED, status=status.HTTP_401_UNAUTHORIZED
                ).create_response()
        
        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        enforce_csrf(request)
        refresh_token = request.COOKIES.get("safecity_refresh_token")
        if not refresh_token:
            return Response({"message": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        if not serializer.is_valid():
            response = Response({"message": "Session expired."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(response)
            return response

        response = Response({"status": status.HTTP_200_OK, "message": "Token refreshed", "data": {}})
        set_auth_cookies(response, serializer.validated_data)
        return response

    @action(detail=False, methods=["post"], url_path="logout")
    def logout(self, request):
        enforce_csrf(request)
        refresh_token = request.COOKIES.get("safecity_refresh_token")
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass

        response = Response({"status": status.HTTP_200_OK, "message": "Logged out", "data": {}})
        clear_auth_cookies(response)
        return response