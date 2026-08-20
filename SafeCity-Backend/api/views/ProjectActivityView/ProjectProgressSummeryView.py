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

class DashboardProgressSummaryView(APIView):
    """
    Authoritative Dashboard progress endpoint.

    Physical progress:
      * project = duration-weighted leaf ProjectActivity progress
      * tehsil/district/division/overall = simple average of project progress,
        preserving the existing Dashboard business rule.

    Financial progress:
      * source values are Project finance fields
      * financial_progress = SUM(PIFRA) / SUM(Spending Release) * 100
      * percentages are calculated after monetary aggregation, never averaged.
    """

    @staticmethod
    def _ratio(numerator, denominator):
        return round((float(numerator or 0) / float(denominator or 0)) * 100, 2) if denominator else None

    @classmethod
    def _financial_payload(cls, allocation, pd_release, spending_release, pifra):
        allocation = float(allocation or 0)
        pd_release = float(pd_release or 0)
        spending_release = float(spending_release or 0)
        pifra = float(pifra or 0)
        return {
            "allocation": allocation,
            "pd_release": pd_release,
            "spending_release": spending_release,
            "pifra": pifra,
            "pd_release_vs_allocation": cls._ratio(pd_release, allocation),
            "spending_release_vs_allocation": cls._ratio(spending_release, allocation),
            "pifra_vs_allocation": cls._ratio(pifra, allocation),
            "financial_progress": cls._ratio(pifra, spending_release),
        }

    def get(self, request):
        projects = list(Project.objects.values(
            "id", "division_id", "district_id", "tehsil_id",
            "allocation_total_cost", "pd_release_total_cost",
            "spending_release_total_cost", "pifra_utilization_total_cost",
        ))

        # -------- Physical: calculate each project from leaf activities --------
        leaf_activities = ProjectActivity.objects.exclude(task_type="wbs").values(
            "project_id", "duration", "progress"
        )
        weighted_sum = defaultdict(float)
        total_weight = defaultdict(float)
        for act in leaf_activities:
            duration = act["duration"] or 1
            progress = act["progress"] or 0
            weighted_sum[act["project_id"]] += progress * duration
            total_weight[act["project_id"]] += duration

        physical_projects = {}
        for project in projects:
            pid = project["id"]
            weight = total_weight.get(pid, 0)
            physical_projects[str(pid)] = round(weighted_sum.get(pid, 0) / weight, 2) if weight > 0 else 0

        def physical_group(field):
            grouped = defaultdict(list)
            for project in projects:
                group_id = project.get(field)
                if group_id is not None:
                    grouped[group_id].append(physical_projects[str(project["id"])])
            return {
                str(group_id): round(sum(values) / len(values), 2) if values else 0
                for group_id, values in grouped.items()
            }

        overall_physical = round(
            sum(physical_projects.values()) / len(physical_projects), 2
        ) if physical_projects else 0
        division_physical = physical_group("division_id")
        district_physical = physical_group("district_id")
        tehsil_physical = physical_group("tehsil_id")

        def average_summary(summary):
            values = list(summary.values())
            return round(sum(values) / len(values), 2) if values else 0

        # -------- Financial: aggregate money first, then calculate ratios --------
        def financial_group(field=None):
            buckets = defaultdict(lambda: {"allocation": 0.0, "pd": 0.0, "spending": 0.0, "pifra": 0.0})
            for project in projects:
                key = project.get(field) if field else "overall"
                if key is None:
                    continue
                bucket = buckets[key]
                bucket["allocation"] += float(project["allocation_total_cost"] or 0)
                bucket["pd"] += float(project["pd_release_total_cost"] or 0)
                bucket["spending"] += float(project["spending_release_total_cost"] or 0)
                bucket["pifra"] += float(project["pifra_utilization_total_cost"] or 0)
            return {
                str(key): self._financial_payload(v["allocation"], v["pd"], v["spending"], v["pifra"])
                for key, v in buckets.items()
            }

        financial_projects = {
            str(p["id"]): self._financial_payload(
                p["allocation_total_cost"], p["pd_release_total_cost"],
                p["spending_release_total_cost"], p["pifra_utilization_total_cost"]
            )
            for p in projects
        }
        overall_financial = financial_group().get("overall", self._financial_payload(0, 0, 0, 0))

        return Response({
            "success": True,
            "physical": {
                "overall": overall_physical,
                "overall_projects": overall_physical,
                "overall_divisions": average_summary(division_physical),
                "overall_districts": average_summary(district_physical),
                "overall_tehsils": average_summary(tehsil_physical),
                "projects": physical_projects,
                "divisions": division_physical,
                "districts": district_physical,
                "tehsils": tehsil_physical,
            },
            "financial": {
                "overall": overall_financial,
                "projects": financial_projects,
                "divisions": financial_group("division_id"),
                "districts": financial_group("district_id"),
                "tehsils": financial_group("tehsil_id"),
            },
        })
