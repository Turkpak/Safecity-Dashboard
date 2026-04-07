from ..common_imports import *
from api.models import ProgressImage


class DeleteProgressImageView(viewsets.ViewSet):

    def destroy(self, request, pk=None):
        try:
            image = ProgressImage.objects.filter(pk=pk).first()

            if not image:
                return ApiResponse(
                    status=status.HTTP_404_NOT_FOUND,
                    message="Image not found.",
                    http_status=status.HTTP_404_NOT_FOUND
                ).create_response()

            image.delete()

            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Image deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()