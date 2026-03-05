from ..common_imports import *

class StakeholderDeleteView(viewsets.ViewSet):
    queryset = Stakeholder.objects.all()
    serializer_class = StakeholderSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Stakeholders"

    def destroy(self, request, *args, **kwargs):
        Stakeholder_id = kwargs.get('pk')

        try:
            mystakeholder = Stakeholder.objects.get(id=Stakeholder_id)
        except Stakeholder.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Stakeholder not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

       
        try:
            mystakeholder.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Stakeholder deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
