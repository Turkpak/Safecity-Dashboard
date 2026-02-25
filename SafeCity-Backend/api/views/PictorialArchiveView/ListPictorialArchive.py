from ..common_imports import *

class ListPictorialArchiveView(viewsets.ViewSet):
    queryset = PictorialArchive.objects.all()
    serializer_class = PictorialArchiveSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        try:
            archive_id = request.query_params.get("id")
            project_id = request.query_params.get("project_id")

            if archive_id:
                archive = PictorialArchive.objects.filter(id=archive_id).first()
                if not archive:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Pictorial archive not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = PictorialArchiveSerializer(archive)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Pictorial archive found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            if project_id:
                queryset = PictorialArchive.objects.filter(project_id=project_id)
                serializer = PictorialArchiveSerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project pictorial archives found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            queryset = PictorialArchive.objects.all()
            serializer = PictorialArchiveSerializer(queryset, many=True)

            return ApiResponse(
                status=status.HTTP_200_OK,
                message="All pictorial archives found.",
                data=serializer.data,
                http_status=status.HTTP_200_OK
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()