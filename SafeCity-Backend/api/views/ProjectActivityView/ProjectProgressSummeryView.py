# views.py
from ..common_imports import *
from django.db.models import Sum, F
from collections import defaultdict
from api.models import ActivityDelayLog  # ensure this is available; remove if common_imports already covers it


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


class ProjectStatusSummaryView(APIView):
    """
    Lightweight per-project status for GIS map + stat cards.
    Returns {project_id: "pending" | "in_progress" | "in_delay"}.
    No nested trees, no images, no delay-log detail — just the derived status.
    Flat, fixed query count regardless of project/activity volume.
    """
    def get(self, request):
        # Query 1: leaf activity progress per project.
        leaf_activities = ProjectActivity.objects.exclude(
            task_type="wbs"
        ).values("project_id", "progress")

        progress_by_project = defaultdict(list)
        for act in leaf_activities:
            progress_by_project[act["project_id"]].append(act["progress"] or 0)

        # Query 2: which projects have at least one delay log, via the activity's project FK.
        delayed_project_ids = set(
            ActivityDelayLog.objects.values_list(
                "activity__project_id", flat=True
            ).distinct()
        )

        # Query 3: all project ids, so every project gets a status even with zero activities.
        all_project_ids = Project.objects.values_list("id", flat=True)

        summary = {}
        for pid in all_project_ids:
            if pid in delayed_project_ids:
                status = "in_delay"
            elif any((p or 0) > 0 for p in progress_by_project.get(pid, [])):
                status = "in_progress"
            else:
                status = "pending"
            summary[str(pid)] = status

        return Response({"success": True, "status_by_project": summary})