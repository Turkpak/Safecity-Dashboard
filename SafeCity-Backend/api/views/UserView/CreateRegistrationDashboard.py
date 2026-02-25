from django.db import IntegrityError
from rest_framework import viewsets, status, serializers
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from ..common_imports import *  # your common imports like ApiResponse, MyUserSerializer

class UserCreateView(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def create(self, request):
        try:
            # Validate incoming data
            serializer = MyUserSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            # Save the user
            user = serializer.save()  # Calls serializer.create()

            # Generate JWT tokens
            refresh = RefreshToken.for_user(user)
            token_data = {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }

            # Return response
            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="User created successfully.",
                data={
                    "user": MyUserSerializer(user).data,
                    "tokens": token_data
                },
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Email already registered.",
                data={"email": ["This email is already registered."]},
                http_status=status.HTTP_400_BAD_REQUEST
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
