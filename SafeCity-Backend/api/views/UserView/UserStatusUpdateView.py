from ..common_imports import *


class UserStatusUpdateView(viewsets.ViewSet):
    """
    Activate or deactivate a user account.

    Only Super Admin can change another user's account status.
    """

    permission_classes = [IsAuthenticated]

    def partial_update(self, request, *args, **kwargs):
        user_id = kwargs.get("pk")

        # ---------------------------------------------------------
        # Only Super Admin can change user account status
        # ---------------------------------------------------------
        if request.user.role != "super_admin":
            return ApiResponse(
                status=status.HTTP_403_FORBIDDEN,
                message="Only Super Admin can activate or deactivate users.",
                http_status=status.HTTP_403_FORBIDDEN
            ).create_response()

        # ---------------------------------------------------------
        # Find user
        # ---------------------------------------------------------
        try:
            myuser = MyUser.objects.get(id=user_id)
        except MyUser.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="User not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        # ---------------------------------------------------------
        # Prevent Super Admin from deactivating their own account
        # ---------------------------------------------------------
        if request.user.id == myuser.id:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="You cannot change the status of your own account.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        # ---------------------------------------------------------
        # Validate is_active
        # ---------------------------------------------------------
        if "is_active" not in request.data:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="The is_active field is required.",
                data={
                    "is_active": ["This field is required."]
                },
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        is_active = request.data.get("is_active")

        # Accept only actual boolean values
        if not isinstance(is_active, bool):
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="is_active must be true or false.",
                data={
                    "is_active": ["Expected a boolean value."]
                },
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        # ---------------------------------------------------------
        # Update status
        # ---------------------------------------------------------
        try:
            myuser.is_active = is_active
            myuser.save(update_fields=["is_active"])

            return ApiResponse(
                status=status.HTTP_200_OK,
                message=(
                    "User activated successfully."
                    if is_active
                    else "User deactivated successfully."
                ),
                data={
                    "id": myuser.id,
                    "email": myuser.email,
                    "is_active": myuser.is_active,
                },
                http_status=status.HTTP_200_OK
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()