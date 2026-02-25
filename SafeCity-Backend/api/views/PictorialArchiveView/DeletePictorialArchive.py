from ..common_imports import *

class PictorialArchiveDeleteView(viewsets.ViewSet):
    queryset = PictorialArchive.objects.all()
    serializer_class = PictorialArchiveSerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        archive_id = kwargs.get('pk')

        try:
            archive = PictorialArchive.objects.get(id=archive_id)

        except PictorialArchive.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Pictorial archive not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            archive.delete()

            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Pictorial archive deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()

        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this archive because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()