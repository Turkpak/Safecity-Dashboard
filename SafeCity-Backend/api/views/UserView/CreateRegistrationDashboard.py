
from django.db import IntegrityError
from rest_framework import viewsets, status, serializers
from rest_framework.throttling import ScopedRateThrottle

from ..common_imports import *


class UserCreateView(viewsets.ViewSet):
    permission_classes = [IsAdminUserForCreate]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "user_create"

    def create(self, request):
        try:
            stakeholder_id = request.data.get("stakeholder")

            if not stakeholder_id:
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="Please select a stakeholder.",
                    data={"stakeholder": ["This field is required."]},
                    http_status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            try:
                stakeholder = Stakeholder.objects.get(
                    pk=stakeholder_id,
                    status="active",
                )
            except (Stakeholder.DoesNotExist, ValueError, TypeError):
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="Please select a valid active stakeholder.",
                    data={
                        "stakeholder": [
                            "The selected stakeholder does not exist or is inactive."
                        ]
                    },
                    http_status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            # Derive role from the selected stakeholder.
            # No hardcoded Consultant/Contractor restriction.
            role = stakeholder.stakeholder_type.strip().lower()

            if not role:
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="The selected stakeholder has no type.",
                    data={"stakeholder": ["Stakeholder type cannot be empty."]},
                    http_status=status.HTTP_400_BAD_REQUEST,
                ).create_response()

            user_data = request.data.copy()
            user_data.pop("role", None)

            serializer = MyUserSerializer(data=user_data)
            serializer.is_valid(raise_exception=True)

            user = serializer.save()
            user.role = role
            user.save(update_fields=["role"])

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="User created successfully.",
                data={"user": MyUserSerializer(user).data},
                http_status=status.HTTP_201_CREATED,
            ).create_response()

        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Email already registered.",
                data={"email": ["This email is already registered."]},
                http_status=status.HTTP_400_BAD_REQUEST,
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
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST,
            ).create_response()
