from ..common_imports import *

from django.db.models.deletion import ProtectedError

class DistrictDeleteView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission]

    def destroy(self, request, *args, **kwargs):
        try:
            district = District.objects.get(id=kwargs.get('pk'))
        except District.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="District not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            district.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="District deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()

        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this district because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()