from ..common_imports import *
class StakeholderDeleteView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission]

    def destroy(self, request, *args, **kwargs):
        try:
            stakeholder = Stakeholder.objects.get(id=kwargs.get('pk'))
        except Stakeholder.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Stakeholder not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        # ✅ IMPORTANT CHECK
        if Project.objects.filter(stakeholder=stakeholder).exists():
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Stakeholder because it is linked to projects.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        stakeholder.delete()
        return ApiResponse(
            status=status.HTTP_200_OK,
            message="Stakeholder deleted successfully.",
            http_status=status.HTTP_200_OK
        ).create_response()