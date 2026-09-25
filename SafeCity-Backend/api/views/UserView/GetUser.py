from ..common_imports import *

class GetUserView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        try:
            user_id = request.query_params.get("id")
            email = request.query_params.get("email")
            requester = request.user
            is_admin = requester.role == "super_admin"

            if user_id or email:
                lookup = {"id": user_id} if user_id else {"email": email}
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
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()