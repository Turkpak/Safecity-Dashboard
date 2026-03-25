from ..common_imports import *
from ...utils import recompute_activity_ancestors

class ProjectActivityUpdateView(viewsets.ViewSet):
    queryset = ProjectActivity.objects.all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [AllowAny]

    def update(self, request, *args, **kwargs):
        data = request.data
        projectactivity_id = kwargs.get('pk') 

        try:
            myprojectactivity = ProjectActivity.objects.get(id=projectactivity_id)

        except ProjectActivity.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Project Activity not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            serializer = ProjectActivitySerializer(myprojectactivity, data=data, partial=True)  
            if serializer.is_valid():
                updated = serializer.save()
                # Keep WBS/summary nodes consistent after any leaf updates
                # (progress and/or dates).
                try:
                    recompute_activity_ancestors(updated)
                except Exception:
                    # Best-effort; do not block the update call.
                    pass
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project Activity updated successfully.",
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
