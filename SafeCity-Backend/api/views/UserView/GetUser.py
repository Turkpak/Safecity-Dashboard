from ..common_imports import *
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from api.utils import REFRESH_TOKEN_COOKIE
import logging
logger = logging.getLogger(__name__)
class GetUserView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(
        detail=False,
        methods=["get"],
        url_path="me",
        permission_classes=[AllowAny],
    )
    def me(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            if request.COOKIES.get(REFRESH_TOKEN_COOKIE):
                return Response(
                    {"message": "Authentication required."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            return Response(
                {
                    "status": status.HTTP_200_OK,
                    "message": "No authenticated session.",
                    "data": None,
                },
                status=status.HTTP_200_OK,
            )

        user = request.user
        permissions = UserPermission.objects.filter(user=user)
        data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "permissions": list(
                permissions.values(
                    "sidebar_label",
                    "sub_label",
                    "can_view",
                    "can_create",
                    "can_update",
                    "can_delete",
                )
            ),
            "stakeholder_type": user.stakeholder.stakeholder_type if user.stakeholder else None,
        }
        return ApiResponse(
            status=status.HTTP_200_OK,
            message="User Found.",
            data=data,
            http_status=status.HTTP_200_OK,
        ).create_response()

    def list(self, request, *args, **kwargs):
        try:
            user_id = request.query_params.get("id")
            email = request.query_params.get("email")
            requester = request.user
            is_admin = requester.role == "super_admin"

            if user_id or email:
                if user_id:
                    try:
                        lookup = {"id": int(user_id)}
                    except (TypeError, ValueError):
                        return ApiResponse(
                            status=status.HTTP_400_BAD_REQUEST,
                            message="Invalid user id.",
                            http_status=status.HTTP_400_BAD_REQUEST,
                        ).create_response()
                else:
                    lookup = {"email": email}
                target = MyUser.objects.filter(**lookup).first()
                if not target:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="User not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                # Non-admins may only look up themselves
                if not is_admin and target.id != requester.id:
                    return ApiResponse(
                        status=status.HTTP_403_FORBIDDEN,
                        message="You do not have permission to view this user.",
                        http_status=status.HTTP_403_FORBIDDEN
                    ).create_response()

                serializer = MyUserSerializer(target)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # No params: bulk listing
            if not is_admin:
                # Non-admins get only their own record, not the whole directory
                serializer = MyUserSerializer(requester)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            queryset = MyUser.objects.all()
            serializer = MyUserSerializer(queryset, many=True)
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="All Users Found.",
                data=serializer.data,
                http_status=status.HTTP_200_OK
            ).create_response()

        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except Exception:
            logger.exception("User update failed")
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Something went wrong. Please try again.",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ).create_response()