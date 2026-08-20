from collections import defaultdict
from ..common_imports import *

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

            # Bulk query leaf activities for all projects in scope
            project_ids = [p.id for p in projects]
            leaf_activities = ProjectActivity.objects.filter(
                project_id__in=project_ids
            ).exclude(task_type="wbs").values("project_id", "duration", "progress")

            weighted_sum = defaultdict(float)
            total_weight = defaultdict(float)
            
            for act in leaf_activities:
                duration = act["duration"] or 1
                progress = act["progress"] or 0
                weighted_sum[act["project_id"]] += progress * duration
                total_weight[act["project_id"]] += duration

            for project in projects:
                weight = total_weight.get(project.id, 0)
                progress = weighted_sum.get(project.id, 0) / weight if weight > 0 else 0
                project.progress = round(progress, 2)

            projects = sorted(projects, key=lambda x: x.progress, reverse=True)[:limit]

            serializer = TopProjectSerializer(projects, many=True)

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
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()