from ..common_imports import *

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

        # Non-admins can never touch privilege fields, even on their own record
        if request.user.role != "super_admin":
            data.pop("role", None)
            data.pop("is_active", None)
            data.pop("is_staff", None)

        try:
            serializer = MyUserSerializer(myuser, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
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
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()