from ..common_imports import *
import logging
from api.jwt_tokens import revoke_user_tokens
logger = logging.getLogger(__name__)
class UserUpdateView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        user_id = kwargs.get('pk')
        try:
            myuser = MyUser.objects.get(id=user_id)
        except MyUser.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="User not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        # Object-level check: only self or super_admin may update this record
        if request.user.id != myuser.id and request.user.role != "super_admin":
            return ApiResponse(
                status=status.HTTP_403_FORBIDDEN,
                message="You do not have permission to update this user.",
                http_status=status.HTTP_403_FORBIDDEN
            ).create_response()

        data = request.data.copy()

        # Non-admins can never touch privilege or ownership fields, even on their own record
        if request.user.role != "super_admin":
            for field in ("role", "is_active", "is_staff", "is_superuser", "stakeholder"):
                data.pop(field, None)

        # A user changing their own password must prove they know the current one
        if data.get("password") and request.user.id == myuser.id:
            if not myuser.check_password(data.get("current_password") or ""):
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="Current password is incorrect.",
                    data={"current_password": ["Incorrect password."]},
                    http_status=status.HTTP_400_BAD_REQUEST,
                ).create_response()
        data.pop("current_password", None)

        try:
            serializer = MyUserSerializer(myuser, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                if "password" in data:
                    revoke_user_tokens(myuser)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User updated successfully.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Validation error.",
                data=serializer.errors,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except Exception:
            logger.exception("User update failed")
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Something went wrong. Please try again.",
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ).create_response()