from ..common_imports import *
from django.db.models.deletion import ProtectedError

class ProvinceDeleteView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission]

    def destroy(self, request, *args, **kwargs):
        try:
            province = Province.objects.get(id=kwargs.get('pk'))
        except Province.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Province not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            province.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Province deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()

        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Province because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()