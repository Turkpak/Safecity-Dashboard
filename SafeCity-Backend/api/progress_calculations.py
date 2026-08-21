from collections import defaultdict

from api.models import ProjectActivity
from api.utils import normalize_progress_to_percent


def calculate_project_physical_progress_map(project_ids=None):
    """Return authoritative duration-weighted physical progress in 0..100.

    WBS rows are excluded. A project is present only when it has at least one
    non-WBS activity, so membership in the returned mapping is also the
    physical-data validity flag. Genuine 0% projects remain present.
    """
    qs = ProjectActivity.objects.exclude(task_type="wbs")
    if project_ids is not None:
        qs = qs.filter(project_id__in=list(project_ids))

    weighted_sum = defaultdict(float)
    total_weight = defaultdict(float)

    for row in qs.values("project_id", "duration", "progress"):
        project_id = row["project_id"]
        duration = float(row["duration"] or 1.0)
        if duration <= 0:
            duration = 1.0
        progress = normalize_progress_to_percent(row["progress"])
        weighted_sum[project_id] += progress * duration
        total_weight[project_id] += duration

    return {
        project_id: round(weighted_sum[project_id] / weight, 2)
        for project_id, weight in total_weight.items()
        if weight > 0
    }
