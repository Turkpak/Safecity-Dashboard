from api.utils import safe_error_data
from ..common_imports import *
from api.progress_calculations import calculate_project_physical_progress_map


class TopProjectsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        try:
            limit = int(request.query_params.get("limit", 6))
            division_id = request.query_params.get("division_id")

            queryset = Project.objects.select_related("division")
            if division_id:
                queryset = queryset.filter(division_id=division_id)

            projects = list(queryset)
            progress_map = calculate_project_physical_progress_map([p.id for p in projects])

            valid_projects = []
            for project in projects:
                if project.id not in progress_map:
                    continue
                project.progress = progress_map[project.id]
                valid_projects.append(project)

            valid_projects.sort(key=lambda project: project.progress, reverse=True)
            serializer = TopProjectSerializer(valid_projects[:limit], many=True)

            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Top projects fetched successfully.",
                data=serializer.data,
                http_status=status.HTTP_200_OK
            ).create_response()
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Error fetching top projects.",
                data=safe_error_data(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
