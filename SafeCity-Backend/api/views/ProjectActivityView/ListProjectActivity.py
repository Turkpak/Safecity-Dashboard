from ..common_imports import *

class ListProjectActivityView(viewsets.ViewSet):
    queryset = ProjectActivity.objects.all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        try:
            projectactivity_id = request.query_params.get("id")

            if projectactivity_id:
                queryset = ProjectActivity.objects.filter(id=projectactivity_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Project Activity not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = ProjectActivitySerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project Activity Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            else:
                queryset = ProjectActivity.objects.all()
                serializer = ProjectActivitySerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Projects activities Found.",
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