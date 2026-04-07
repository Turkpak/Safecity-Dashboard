from ..common_imports import *
from api.models import ProgressImage
from api.serializers import ProgressImageSerializer


class ProgressImageUpdateView(viewsets.ViewSet):

    def update(self, request, pk=None):
        try:
            image = ProgressImage.objects.get(pk=pk)

        except ProgressImage.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Progress Image not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            # ✅ include FILES for image update
            data = request.data.copy()

            serializer = ProgressImageSerializer(
                image,
                data=data,
                partial=True,
                context={"request": request}  # ✅ important
            )

            if serializer.is_valid():
                serializer.save()

                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Progress Image updated successfully.",
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
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()