from ..common_imports import *

class PictorialArchiveUpdateView(viewsets.ViewSet):
    queryset = PictorialArchive.objects.all()
    serializer_class = PictorialArchiveSerializer
    permission_classes = [AllowAny]

    def update(self, request, *args, **kwargs):
        archive_id = kwargs.get('pk')
        data = request.data

        try:
            archive = PictorialArchive.objects.get(id=archive_id)

        except PictorialArchive.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Pictorial archive not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            serializer = PictorialArchiveSerializer(archive, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()

                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Pictorial archive updated successfully.",
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