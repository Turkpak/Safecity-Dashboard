from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from ..common_imports import *
from django.contrib.auth import get_user_model

class UserLoginDashboardCreateView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserLoginDashboardSerializer
    permission_classes = [AllowAny]

    def create(self, request):
        
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
                login(request, user)  # manually log in
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
                    'token': auth_data['access'],
                    'refresh': auth_data['refresh'],
                    'role': user.role,
                    'permissions': permissions_data,
                    'stakeholder_id': user.stakeholder.id if user.stakeholder else None,
                    'stakeholder_type': user.stakeholder.stakeholder_type if user.stakeholder else None,
                    'is_active': user.is_active,
                    **auth_data  
                }
                return ApiResponse(
                    status=status.HTTP_200_OK, message="Login Success", data=res, http_status=status.HTTP_200_OK
                    ).create_response()

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