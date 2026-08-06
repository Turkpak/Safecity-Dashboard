
# views.py
from ..common_imports import *
from django.db.models import Sum, F
from collections import defaultdict

class ProjectProgressSummaryView(APIView):
    """
    Lightweight endpoint for dashboard cards: returns {project_id: progress}
    without building the full Gantt tree, delay logs, or images.
    """
    def get(self, request):
        leaf_activities = ProjectActivity.objects.exclude(
            task_type="wbs"
        ).values("project_id", "duration", "progress")

        weighted_sum = defaultdict(float)
        total_weight = defaultdict(float)

        for act in leaf_activities:
            duration = act["duration"] or 1
            progress = act["progress"] or 0
            if progress <= 1:
                progress *= 100
            weighted_sum[act["project_id"]] += progress * duration
            total_weight[act["project_id"]] += duration

        summary = {}
        for project_id, weight in total_weight.items():
            summary[str(project_id)] = round(weighted_sum[project_id] / weight, 2) if weight > 0 else 0

        all_project_ids = Project.objects.values_list("id", flat=True)
        for pid in all_project_ids:
            summary.setdefault(str(pid), 0)

        return Response({"success": True, "progress_by_project": summary})