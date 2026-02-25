from ..common_imports import *

class GetUserView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        try:
            user_id = request.query_params.get("id")
            email = request.query_params.get("email")
            
            if user_id:
                queryset = MyUser.objects.filter(id=user_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="User not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = MyUserSerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            elif email:
                queryset = MyUser.objects.filter(email=email).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="User not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = MyUserSerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            else:
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