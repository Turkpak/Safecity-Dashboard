from ..common_imports import *

class ProjectUpdateLogView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        project_id = request.query_params.get("project_id")
        queryset = ProjectUpdateLog.objects.all().order_by("-created_at")
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        serializer = ProjectUpdateLogSerializer(queryset, many=True)
        return ApiResponse(
            status=status.HTTP_200_OK,
            message="Project update logs fetched successfully.",
            data=serializer.data,
            http_status=status.HTTP_200_OK,
        ).create_response()
