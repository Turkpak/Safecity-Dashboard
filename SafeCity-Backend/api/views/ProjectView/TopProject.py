from ..common_imports import *
from collections import defaultdict

class TopProjectsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        try:
            limit = int(request.query_params.get("limit", 6))
            division_id = request.query_params.get("division_id")

            queryset = Project.objects.select_related("division")

            # ✅ Filter
            if division_id:
                queryset = queryset.filter(division_id=division_id)

            projects = list(queryset)
            project_ids = [project.id for project in projects]

            activities = ProjectActivity.objects.filter(project_id__in=project_ids).order_by('id')
            activities_by_project = defaultdict(list)
            for activity in activities:
                activities_by_project[activity.project_id].append(activity)

            for project in projects:
                project.progress = round(
                    self._compute_project_progress(activities_by_project.get(project.id, [])),
                    2,
                )

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

    def _normalize_progress(self, value):
        if value is None:
            return 0.0
        try:
            progress = float(value)
        except (TypeError, ValueError):
            return 0.0
        if progress <= 1:
            return progress * 100
        return progress

    def _compute_project_progress(self, activities):
        if not activities:
            return 0.0

        children_by_parent = defaultdict(list)
        for activity in activities:
            parent_id = activity.parent_id or 0
            children_by_parent[parent_id].append(activity)

        def calculate_node(node):
            children = children_by_parent.get(node.id, [])
            if not children:
                progress = self._normalize_progress(node.progress or 0)
                duration = node.duration or 1
                return progress, max(duration, 1)

            total_weight = 0
            weighted_progress = 0
            total_duration = 0

            for child in children:
                child_progress, child_duration = calculate_node(child)
                weighted_progress += child_progress * child_duration
                total_weight += child_duration
                total_duration += child_duration

            avg_progress = weighted_progress / total_weight if total_weight > 0 else 0
            duration = total_duration or 1
            return self._normalize_progress(avg_progress), max(duration, 1)

        root_tasks = children_by_parent.get(0, [])
        if not root_tasks:
            return 0.0

        total_weight = 0
        weighted_progress = 0
        for task in root_tasks:
            task_progress, task_duration = calculate_node(task)
            weighted_progress += task_progress * task_duration
            total_weight += task_duration

        return weighted_progress / total_weight if total_weight > 0 else 0.0